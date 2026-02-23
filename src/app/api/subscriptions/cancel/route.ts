/**
 * POST /api/subscriptions/cancel
 *
 * Cancels an active CustomerSubscription. Sets status to 'cancelled'
 * and records the cancellation timestamp.
 *
 * Body: { subscriptionId: string }
 *
 * Returns: { success: true }
 *
 * Auth: Firebase ID token required. Caller must own the subscription
 * (customerId matches) or be an admin.
 *
 * MVP NOTE: No Stripe cancellation logic (Stripe not yet wired).
 * When Stripe is connected, call stripe.subscriptions.cancel() here
 * before updating Firestore.
 */

import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/firebaseAdmin';

export const runtime = 'nodejs';

const schema = z.object({
  subscriptionId: z.string().min(1),
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

  const { subscriptionId } = body;

  // 3. Load the subscription
  const subSnap = await adminDb.collection('subscriptions').doc(subscriptionId).get();
  if (!subSnap.exists) {
    return Response.json({ error: 'Subscription not found' }, { status: 404 });
  }

  const subData = subSnap.data()!;

  // 4. Check ownership or admin
  const callerIsOwner = subData.customerId === decodedToken.uid;

  let callerIsAdmin = false;
  try {
    const userSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
    callerIsAdmin = userSnap.exists && userSnap.data()?.role === 'admin';
  } catch {
    // Non-critical
  }

  if (!callerIsOwner && !callerIsAdmin) {
    return Response.json({ error: 'Forbidden — not your subscription' }, { status: 403 });
  }

  // 5. Guard: only active subscriptions can be cancelled
  if (subData.status !== 'active') {
    return Response.json(
      { error: `Subscription is already ${subData.status}` },
      { status: 400 }
    );
  }

  // 6. Cancel
  try {
    await adminDb.collection('subscriptions').doc(subscriptionId).update({
      status:      'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
    });

    return Response.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to cancel subscription';
    console.error('[subscriptions/cancel] error:', err);
    return Response.json({ error: message }, { status: 500 });
  }
}
