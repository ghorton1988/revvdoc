/**
 * PATCH /api/bookings/status
 *
 * Updates a booking's status. On completion, automatically creates a
 * serviceHistory record and updates the vehicle's lastServiceDate.
 *
 * Request body:
 * {
 *   bookingId:        string;
 *   userId:           string;           // Firebase UID of the caller
 *   status:           BookingStatus;    // target status
 *   techNotes?:       string;           // optional tech notes (for 'complete')
 *   mileageAtService?: number;          // mileage at service (for 'complete')
 * }
 *
 * Auth rules:
 *   - Customer (customerId) → can only cancel ('cancelled') a pending booking
 *   - Technician (technicianId) → can advance status forward
 *   - Caller must be one of the two above (ownership enforced)
 *
 * On 'complete':
 *   1. Creates serviceHistory document from booking snapshot
 *   2. Updates vehicles/{vehicleId}.lastServiceDate + lastServiceSnapshot
 *
 * Auth: Firebase ID token required in Authorization header.
 */

import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/firebaseAdmin';
import type { BookingStatus } from '@/types';

export const runtime = 'nodejs';

/** Valid forward-only status progression. */
const STATUS_ORDER: BookingStatus[] = [
  'pending',
  'accepted',
  'en_route',
  'in_progress',
  'complete',
];

const bodySchema = z.object({
  bookingId:        z.string().min(1),
  userId:           z.string().min(1),
  status:           z.enum(['pending', 'accepted', 'en_route', 'in_progress', 'complete', 'cancelled']),
  techNotes:        z.string().max(1000).optional(),
  mileageAtService: z.number().int().nonnegative().optional(),
});

export async function PATCH(request: Request) {
  // 1. Auth
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
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return Response.json({ error: 'Invalid request body', details: err }, { status: 400 });
  }

  const { bookingId, userId, status: targetStatus, techNotes, mileageAtService } = body;

  if (decodedToken.uid !== userId) {
    return Response.json({ error: 'Forbidden — userId mismatch' }, { status: 403 });
  }

  // 3. Load booking
  const bookingSnap = await adminDb.collection('bookings').doc(bookingId).get();
  if (!bookingSnap.exists) {
    return Response.json({ error: 'Booking not found' }, { status: 404 });
  }

  const booking = bookingSnap.data()!;
  const currentStatus = booking.status as BookingStatus;
  const isCustomer    = booking.customerId === userId;
  const isTechnician  = booking.technicianId === userId;

  // 4. Check caller is a party to this booking
  if (!isCustomer && !isTechnician) {
    return Response.json({ error: 'Forbidden — not your booking' }, { status: 403 });
  }

  // 5. Enforce access rules per status transition
  if (targetStatus === 'cancelled') {
    // Only customer can cancel, and only from 'pending'
    if (!isCustomer) {
      return Response.json({ error: 'Only the customer can cancel a booking' }, { status: 403 });
    }
    if (currentStatus !== 'pending') {
      return Response.json({ error: 'Only pending bookings can be cancelled' }, { status: 409 });
    }
  } else {
    // Forward transitions: technician only
    if (!isTechnician) {
      return Response.json({ error: 'Only the assigned technician can advance booking status' }, { status: 403 });
    }

    const currentIdx = STATUS_ORDER.indexOf(currentStatus);
    const targetIdx  = STATUS_ORDER.indexOf(targetStatus);
    if (targetIdx <= currentIdx) {
      return Response.json({
        error: `Cannot transition from '${currentStatus}' to '${targetStatus}'`,
      }, { status: 409 });
    }
  }

  // 6. Apply status update
  await adminDb.collection('bookings').doc(bookingId).update({
    status:    targetStatus,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 7. On complete: create serviceHistory + update vehicle
  if (targetStatus === 'complete') {
    const now        = new Date();
    const vehicleId  = booking.vehicleId as string;
    const customerId = booking.customerId as string;
    const ss         = booking.serviceSnapshot as {
      serviceId: string;
      name: string;
      category: string;
      basePrice: number;
      durationMins: number;
    };
    const vs = booking.vehicleSnapshot as {
      vehicleId: string;
      mileage: number;
    };

    // Write serviceHistory document (Admin SDK — bypasses client security rules)
    adminDb.collection('serviceHistory').add({
      vehicleId,
      bookingId,
      customerId,
      serviceType:      ss.category,
      serviceTitle:     ss.name,
      source:           'booking',
      date:             now,
      completedAt:      now,
      mileageAtService: mileageAtService ?? vs.mileage ?? 0,
      cost:             booking.totalPrice ?? 0,
      techNotes:        techNotes ?? booking.notes ?? null,
      partsUsed:        [],
      photoUrls:        [],
      warrantyInfo:     null,
      createdAt:        FieldValue.serverTimestamp(),
    }).catch((err) => console.error('[bookings/status] serviceHistory write error:', err));

    // Update vehicle lastServiceDate + lastServiceSnapshot (fire-and-forget)
    adminDb.collection('vehicles').doc(vehicleId).update({
      lastServiceDate:     now,
      lastServiceSnapshot: { serviceTitle: ss.name, date: now },
    }).catch((err) => console.error('[bookings/status] vehicle update error:', err));
  }

  return Response.json({ bookingId, status: targetStatus }, { status: 200 });
}
