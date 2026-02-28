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
import { geocodeAddress, buildAddressString } from '@/lib/maps/geocode';
import type { BookingStatus } from '@/types';

export const runtime = 'nodejs';

/**
 * Placeholder technician ID used during development / demo.
 * Replace with real technician assignment logic before production.
 */
const DEMO_TECH_ID = 'demo-tech-1';

/** Valid forward-only status progression. */
const STATUS_ORDER: BookingStatus[] = [
  'pending',
  'accepted',
  'scheduled',
  'en_route',
  'in_progress',
  'complete',
];

const bodySchema = z.object({
  bookingId:        z.string().min(1),
  userId:           z.string().min(1),
  status:           z.enum(['pending', 'accepted', 'scheduled', 'en_route', 'in_progress', 'complete', 'cancelled']),
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

  // Special case: any authenticated user may accept a pending booking.
  // Before acceptance the technicianId field is null, so isTechnician would
  // always be false — the normal party-check would incorrectly block it.
  const isAcceptingPending =
    targetStatus === 'accepted' && currentStatus === 'pending';

  // 4. Check caller is a party to this booking
  if (!isCustomer && !isTechnician && !isAcceptingPending) {
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
    // Forward transitions: technician only — except for the initial acceptance
    // of a pending booking (no technician is assigned yet at that point).
    if (!isTechnician && !isAcceptingPending) {
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

  // 6. Apply status update — branched by target status
  //
  // ── accepted: create job doc + write jobId back to booking (atomic) ─────────
  //
  // A job document must exist before the booking detail page can subscribe
  // to live tech location via useLiveJob(booking.jobId).
  //
  // Idempotency: if booking already has a jobId (e.g. duplicate request),
  // skip creation and return the existing id immediately.
  if (targetStatus === 'accepted') {
    const existingJobId = booking.jobId as string | null | undefined;

    if (existingJobId) {
      console.log(`[bookings/status] booking ${bookingId} already has jobId ${existingJobId} — skipping job creation`);
      return Response.json({ bookingId, status: targetStatus, jobId: existingJobId }, { status: 200 });
    }

    const jobRef   = adminDb.collection('jobs').doc(); // auto-generated ID
    const newJobId = jobRef.id;

    // Atomic: create job doc + stamp jobId + technicianId on booking.
    await adminDb.runTransaction(async (tx) => {
      tx.set(jobRef, {
        bookingId,
        technicianId: DEMO_TECH_ID,  // placeholder — replace with real assignment
        customerId:   booking.customerId as string,
        status:       'accepted',    // job-level status mirror
        currentStage: 'dispatched',  // first stage in JobStage progression
        stages:       [],
        techLocation: null,          // populated when tech starts GPS broadcast
        route:        null,          // reserved for future route polyline storage
        etaMinutes:   null,          // populated by technician app
        notes:        null,
        startedAt:    null,
        completedAt:  null,
        createdAt:    FieldValue.serverTimestamp(),
        updatedAt:    FieldValue.serverTimestamp(),
      });
      tx.update(adminDb.collection('bookings').doc(bookingId), {
        status:       targetStatus,
        technicianId: DEMO_TECH_ID,  // stamp placeholder tech on booking
        jobId:        newJobId,
        updatedAt:    FieldValue.serverTimestamp(),
      });
    });

    console.log(`JOB CREATED FOR BOOKING ${bookingId}: ${newJobId}`);

    // Fallback geocode: if coords are still 0 (create-time geocode failed or
    // booking pre-dates that feature), resolve them now. Fire-and-forget —
    // listenToBooking subscribers receive the update via a second onSnapshot.
    const addr = booking.address as { street: string; city: string; state: string; zip: string; lat: number; lng: number } | null;
    if (addr?.street && !(addr.lat && addr.lng)) {
      geocodeAddress(buildAddressString(addr))
        .then(async (coords) => {
          if (!coords) return;
          await adminDb.collection('bookings').doc(bookingId).update({
            'address.lat': coords.lat,
            'address.lng': coords.lng,
          });
          console.log(`[bookings/status] geocoded ${bookingId} → ${coords.lat}, ${coords.lng}`);
        })
        .catch((err: unknown) => console.error('[bookings/status] geocode error:', err));
    }

    return Response.json({ bookingId, status: targetStatus, jobId: newJobId }, { status: 200 });
  }

  // ── All other transitions: simple status update ───────────────────────────
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
