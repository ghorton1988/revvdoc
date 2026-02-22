/**
 * POST /api/stripe/create-payment-intent
 *
 * Creates a Stripe PaymentIntent with capture_method: 'manual'
 * (pre-authorize — card is held but NOT charged yet).
 * Writes the paymentIntentId to the booking document.
 *
 * Body: { bookingId, amountCents }
 * Returns: { clientSecret, paymentIntentId }
 */

import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebase/firebaseAdmin';
import stripe from '@/lib/stripe/stripe';

const schema = z.object({
  bookingId: z.string().min(1),
  amountCents: z.number().int().min(50),
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

  const { bookingId, amountCents } = body;
  const uid = decodedToken.uid;

  // 3. Fetch or create Stripe customer
  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }
  const userData = userSnap.data()!;

  let stripeCustomerId: string = userData.stripeCustomerId ?? '';
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: userData.email,
      name: userData.name,
      metadata: { firebaseUid: uid },
    });
    stripeCustomerId = customer.id;
    await userRef.update({ stripeCustomerId });
  }

  // 4. Verify booking belongs to this user
  const bookingSnap = await adminDb.collection('bookings').doc(bookingId).get();
  if (!bookingSnap.exists) {
    return Response.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (bookingSnap.data()?.customerId !== uid) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 5. Create PaymentIntent (pre-authorize, do not capture yet)
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: stripeCustomerId,
    capture_method: 'manual',
    metadata: { bookingId, firebaseUid: uid },
    automatic_payment_methods: { enabled: true },
  });

  // 6. Save paymentIntentId to booking
  await adminDb.collection('bookings').doc(bookingId).update({
    stripePaymentIntentId: paymentIntent.id,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return Response.json({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  });
}
