/**
 * POST /api/subscriptions/enroll
 *
 * Creates a new CustomerSubscription for the authenticated customer.
 * All subscription writes use Admin SDK — no client-side write to subscriptions/.
 *
 * Body: { planId: string; vehicleId: string }
 *
 * Returns: { subscriptionId: string }
 *
 * Preconditions:
 *  - Caller owns the vehicle
 *  - No existing active subscription for this plan + vehicle combo
 *  - Plan is active
 *
 * MVP NOTE: Stripe subscription payment is NOT yet wired.
 * stripeSubscriptionId is set to null. When Stripe is connected,
 * this route must first create a Stripe Subscription before writing to Firestore.
 *
 * Auth: Firebase ID token required in Authorization header.
 */

import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/firebaseAdmin';
import type { SubscriptionPlan, SubscriptionStatus } from '@/types';

export const runtime = 'nodejs';

const schema = z.object({
  planId:    z.string().min(1),
  vehicleId: z.string().min(1),
});

export async function POST(request: Request) {
  // 1. Verify Firebase ID token
  const authorization = request.headers.get('Authorization') ?? '';
  const idToken = authorization.replace('Bearer ', '');
  if (!idToken) {
    return Response.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }

  // 2. Validate body
  let body;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    return Response.json({ error: 'Invalid request body', details: err }, { status: 400 });
  }

  const { planId, vehicleId } = body;
  const customerId = decodedToken.uid;

  // 3. Verify vehicle ownership
  const vehicleSnap = await adminDb.collection('vehicles').doc(vehicleId).get();
  if (!vehicleSnap.exists || vehicleSnap.data()?.ownerId !== customerId) {
    return Response.json({ error: 'Vehicle not found or not yours' }, { status: 403 });
  }

  // 4. Load plan
  const planSnap = await adminDb.collection('subscriptionPlans').doc(planId).get();
  if (!planSnap.exists) {
    return Response.json({ error: 'Plan not found' }, { status: 404 });
  }
  const plan = planSnap.data() as SubscriptionPlan;
  if (!plan.isActive) {
    return Response.json({ error: 'Plan is not active' }, { status: 400 });
  }

  // 5. Check no existing active subscription for this plan + vehicle
  const existingSnap = await adminDb
    .collection('subscriptions')
    .where('customerId', '==', customerId)
    .where('planId', '==', planId)
    .where('vehicleId', '==', vehicleId)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    return Response.json({ error: 'Already subscribed to this plan for this vehicle' }, { status: 409 });
  }

  // 6. Compute period start/end from plan.period
  const now = new Date();
  const periodStart = now;
  const periodEnd = new Date(now);

  switch (plan.period) {
    case 'monthly':
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      break;
    case 'quarterly':
      periodEnd.setMonth(periodEnd.getMonth() + 3);
      break;
    case 'annual':
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      break;
    default:
      periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  // 7. Create subscription document
  try {
    const subscriptionRef = await adminDb.collection('subscriptions').add({
      customerId,
      planId,
      vehicleId,
      status:               'active' as SubscriptionStatus,
      currentPeriodStart:   periodStart,
      currentPeriodEnd:     periodEnd,
      usageThisPeriod:      [],
      stripeSubscriptionId: null, // reserved — not yet wired
      createdAt:            FieldValue.serverTimestamp(),
      cancelledAt:          null,
    });

    return Response.json({ subscriptionId: subscriptionRef.id }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create subscription';
    console.error('[subscriptions/enroll] error:', err);
    return Response.json({ error: message }, { status: 500 });
  }
}
