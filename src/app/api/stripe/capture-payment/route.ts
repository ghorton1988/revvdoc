/**
 * POST /api/stripe/capture-payment
 *
 * Captures a previously authorized PaymentIntent (charges the customer).
 * Called when the technician marks a job as complete.
 * Also performs job completion side-effects in a single server-side transaction.
 *
 * Body: { bookingId, jobId }
 * Returns: { success: true, amountCaptured }
 */

import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebase/firebaseAdmin';
import stripe from '@/lib/stripe/stripe';

export const runtime = 'nodejs';

const schema = z.object({
  bookingId: z.string().min(1),
  jobId: z.string().min(1),
});

export async function POST(request: Request) {
  // 1. Verify Firebase ID token — must be the assigned technician
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

  const { bookingId, jobId } = body;

  // 3. Fetch booking
  const bookingSnap = await adminDb.collection('bookings').doc(bookingId).get();
  if (!bookingSnap.exists) {
    return Response.json({ error: 'Booking not found' }, { status: 404 });
  }
  const booking = bookingSnap.data()!;

  if (booking.technicianId !== decodedToken.uid) {
    return Response.json({ error: 'Forbidden — not your job' }, { status: 403 });
  }

  const { stripePaymentIntentId, customerId, vehicleId, totalPrice, serviceSnapshot, vehicleSnapshot } = booking;

  if (!stripePaymentIntentId) {
    return Response.json({ error: 'No payment intent on booking' }, { status: 409 });
  }

  // 4. Capture Stripe PaymentIntent
  let capturedIntent;
  try {
    capturedIntent = await stripe.paymentIntents.capture(stripePaymentIntentId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Stripe capture failed';
    return Response.json({ error: message }, { status: 502 });
  }

  const amountCaptured = capturedIntent.amount_received;

  // 5. Firestore transaction — job completion side-effects
  const now = FieldValue.serverTimestamp();
  const historyRef = adminDb.collection('serviceHistory').doc();

  try {
    await adminDb.runTransaction(async (tx) => {
      // a. Complete booking
      tx.update(adminDb.collection('bookings').doc(bookingId), {
        status: 'complete',
      });

      // b. Complete job
      tx.update(adminDb.collection('jobs').doc(jobId), {
        completedAt: now,
        currentStage: 'complete',
        stages: FieldValue.arrayUnion({
          stage: 'complete',
          enteredAt: now,
          note: null,
        }),
      });

      // c. Create serviceHistory record
      tx.set(historyRef, {
        vehicleId,
        bookingId,
        customerId,
        serviceType: serviceSnapshot.category,
        date: now,
        mileageAtService: vehicleSnapshot.mileage,
        cost: totalPrice,
        techNotes: null,
      });

      // d. Update vehicle
      tx.update(adminDb.collection('vehicles').doc(vehicleId), {
        lastServiceDate: now,
        status: 'OPTIMAL',
      });

      // e. Clear technician's current job
      tx.update(adminDb.collection('users').doc(decodedToken.uid), {
        currentJobId: null,
      });
    });
  } catch (err: unknown) {
    console.error('[capture-payment] Firestore transaction error:', err);
    // Payment already captured — log but still return success to avoid retry loops
    return Response.json({
      success: true,
      amountCaptured,
      warning: 'Payment captured but job completion update failed',
    });
  }

  // 6. Create notification for customer (non-critical, outside transaction)
  try {
    await adminDb.collection('notifications').add({
      userId: customerId,
      type: 'job_complete',
      title: 'Service Complete',
      body: `Your ${serviceSnapshot.name} service is complete. Thanks for using RevvDoc!`,
      read: false,
      relatedBookingId: bookingId,
      relatedJobId: jobId,
      createdAt: now,
    });

    await adminDb.collection('notifications').add({
      userId: customerId,
      type: 'payment_captured',
      title: 'Payment Processed',
      body: `$${(amountCaptured / 100).toFixed(2)} has been charged for your service.`,
      read: false,
      relatedBookingId: bookingId,
      relatedJobId: jobId,
      createdAt: now,
    });
  } catch (err) {
    console.error('[capture-payment] notification error:', err);
  }

  return Response.json({ success: true, amountCaptured });
}
