/**
 * POST /api/admin/assign-technician
 *
 * Admin-only route to manually assign a technician to a pending booking.
 * Also creates the Job document.
 *
 * Body: { bookingId, technicianId }
 * Returns: { success: true, jobId }
 */

import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebase/firebaseAdmin';

export const runtime = 'nodejs';

const schema = z.object({
  bookingId: z.string().min(1),
  technicianId: z.string().min(1),
});

export async function POST(request: Request) {
  // 1. Verify admin token
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

  const callerSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
    return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  // 2. Validate body
  let body;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    return Response.json({ error: 'Invalid request body', details: err }, { status: 400 });
  }

  const { bookingId, technicianId } = body;

  // 3. Firestore transaction: assign + create Job
  let jobId: string;
  try {
    const bookingRef = adminDb.collection('bookings').doc(bookingId);
    const jobRef = adminDb.collection('jobs').doc();
    jobId = jobRef.id;

    await adminDb.runTransaction(async (tx) => {
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists) throw new Error('Booking not found');
      const booking = bookingSnap.data()!;
      if (booking.status !== 'pending') throw new Error('Booking is not pending');

      // a+b. Update booking
      tx.update(bookingRef, {
        technicianId,
        status: 'accepted',
      });

      // c. Create job
      tx.set(jobRef, {
        bookingId,
        technicianId,
        customerId: booking.customerId,
        stages: [{ stage: 'dispatched', enteredAt: FieldValue.serverTimestamp(), note: null }],
        currentStage: 'dispatched',
        techLocation: null,
        notes: null,
        startedAt: null,
        completedAt: null,
      });

      // d. Update technician currentJobId
      tx.update(adminDb.collection('users').doc(technicianId), {
        currentJobId: jobId,
      });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Transaction failed';
    return Response.json({ error: message }, { status: 409 });
  }

  // 4. Create notification for customer (outside transaction — non-critical)
  try {
    const bookingSnap = await adminDb.collection('bookings').doc(bookingId).get();
    const customerId = bookingSnap.data()?.customerId as string;
    if (customerId) {
      await adminDb.collection('notifications').add({
        userId: customerId,
        type: 'technician_accepted',
        title: 'Technician Assigned',
        body: 'A technician has been assigned to your booking and is on the way.',
        read: false,
        relatedBookingId: bookingId,
        relatedJobId: jobId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  } catch (err) {
    console.error('[assign-technician] notification error:', err);
  }

  return Response.json({ success: true, jobId });
}
