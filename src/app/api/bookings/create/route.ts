/**
 * POST /api/bookings/create
 *
 * Creates a new booking from the customer booking flow.
 * No Stripe integration — status is set to 'pending' on creation.
 * Payment is handled later when a technician accepts the job.
 *
 * Request body:
 * {
 *   userId:              string;             // Firebase UID
 *   vehicleId:           string;             // Firestore vehicle doc ID
 *   serviceId:           string;             // Firestore service doc ID
 *   scheduledDate:       string;             // ISO date string, e.g. "2026-03-15"
 *   scheduledTimeWindow: 'morning' | 'afternoon' | 'evening';
 *   notes?:              string;             // optional customer notes
 *   source?:             'assistant' | 'schedule' | 'history' | 'manual';
 * }
 *
 * Response:
 * { bookingId: string }
 *
 * Auth: Firebase ID token required in Authorization header.
 * Caller must own the vehicle.
 */

import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/firebaseAdmin';
import { geocodeAddress, buildAddressString } from '@/lib/maps/geocode';
import type { Service, ServiceSnapshot, VehicleSnapshot } from '@/types';

export const runtime = 'nodejs';

/**
 * Address sub-schema.
 * street / city / state / zip are required — no booking can be dispatched
 * without a service location. lat / lng default to 0 and are geocoded
 * server-side (in the status route) when the booking is accepted.
 */
const addressSchema = z.object({
  street: z.string().min(1, 'street is required'),
  city:   z.string().min(1, 'city is required'),
  state:  z.string().length(2, 'state must be a 2-letter code (e.g. "MD")'),
  zip:    z.string().regex(/^\d{5}(-\d{4})?$/, 'zip must be 5 or 9 digits'),
  lat:    z.number().default(0),
  lng:    z.number().default(0),
});

const bodySchema = z.object({
  userId:              z.string().min(1),
  vehicleId:           z.string().min(1),
  serviceId:           z.string().min(1),
  scheduledDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'scheduledDate must be YYYY-MM-DD'),
  scheduledTimeWindow: z.enum(['morning', 'afternoon', 'evening']),
  address:             addressSchema,
  notes:               z.string().max(500).optional(),
  source:              z.enum(['assistant', 'schedule', 'history', 'manual']).optional(),
});

/** Maps a time window label to the start hour for scheduledAt (24h). */
const TIME_WINDOW_HOURS: Record<'morning' | 'afternoon' | 'evening', number> = {
  morning:   8,
  afternoon: 12,
  evening:   17,
};

/** Strips undefined values so Firestore never receives them. */
function clean(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export async function POST(request: Request) {
  try {
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
    console.log('[bookings/create] Auth verified, uid:', decodedToken.uid);

    // 2. Validate body
    let body;
    try {
      body = bodySchema.parse(await request.json());
    } catch (err) {
      return Response.json({ error: 'Invalid request body', details: err }, { status: 400 });
    }

    const { userId, vehicleId, serviceId, scheduledDate, scheduledTimeWindow, address, notes, source } = body;

    // Ensure authenticated user matches the requested userId
    if (decodedToken.uid !== userId) {
      return Response.json({ error: 'Forbidden — userId mismatch' }, { status: 403 });
    }

    // 3. Verify vehicle ownership
    const vehicleSnap = await adminDb.collection('vehicles').doc(vehicleId).get();
    if (!vehicleSnap.exists || vehicleSnap.data()?.ownerId !== userId) {
      return Response.json({ error: 'Forbidden — not your vehicle' }, { status: 403 });
    }
    console.log('[bookings/create] Vehicle ownership verified, vehicleId:', vehicleId);

    const vehicleData = vehicleSnap.data()!;

    // 4. Load service from catalog
    const serviceSnap = await adminDb.collection('services').doc(serviceId).get();
    if (!serviceSnap.exists) {
      return Response.json({ error: 'Service not found' }, { status: 404 });
    }

    const serviceData = serviceSnap.data() as Service;
    if (!serviceData.isActive) {
      return Response.json({ error: 'Service is no longer available' }, { status: 409 });
    }

    // 5. Build scheduledAt from date + time window
    const startHour = TIME_WINDOW_HOURS[scheduledTimeWindow];
    const scheduledAt = new Date(`${scheduledDate}T00:00:00`);
    scheduledAt.setHours(startHour, 0, 0, 0);

    if (scheduledAt < new Date()) {
      return Response.json({ error: 'scheduledDate must be in the future' }, { status: 400 });
    }

    // 6. Build denormalized snapshots
    // Note: Firestore .data() does NOT include the doc ID — use snap.id as the authoritative fallback.
    const serviceSnapshot: ServiceSnapshot = {
      serviceId:    serviceData.serviceId    ?? serviceSnap.id,
      name:         serviceData.name         ?? '',
      category:     serviceData.category     ?? 'mechanic',
      basePrice:    serviceData.basePrice    ?? 0,
      durationMins: serviceData.durationMins ?? 0,
    };

    const vehicleSnapshot: VehicleSnapshot = {
      vehicleId: vehicleData.vehicleId ?? vehicleSnap.id,
      vin:       vehicleData.vin       ?? '',
      make:      vehicleData.make      ?? '',
      model:     vehicleData.model     ?? '',
      year:      vehicleData.year      ?? 0,
      nickname:  vehicleData.nickname  ?? null,
      mileage:   vehicleData.mileage   ?? 0,
    };

    console.log('[bookings/create] serviceSnapshot:', serviceSnapshot);

    // 7. Write booking to Firestore
    console.log('[bookings/create] Writing booking to Firestore...');
    const bookingRef = await adminDb.collection('bookings').add(clean({
      customerId:           userId,
      technicianId:         null,
      jobId:                null,
      vehicleId,
      serviceId,
      serviceSnapshot,
      vehicleSnapshot,
      scheduledAt,
      flexDateEnd:          null,
      status:               'pending',
      address,              // validated above — street/city/state/zip required; lat/lng default 0
      totalPrice:           serviceData.basePrice ?? 0,
      stripePaymentIntentId: null,
      scheduledTimeWindow,
      notes:                notes ?? null,
      source:               source ?? 'manual',
      createdAt:            FieldValue.serverTimestamp(),
    }));
    console.log('[bookings/create] Booking written, id:', bookingRef.id);

    // Geocode the address immediately — fire-and-forget so the response is
    // not blocked. The booking detail page subscribes via listenToBooking and
    // will receive the coords via a second onSnapshot push once the write lands.
    // The status route re-runs geocoding on 'accepted' as a fallback in case
    // this call fails (e.g. cold-start latency, transient API error).
    const bookingId = bookingRef.id;
    geocodeAddress(buildAddressString(address))
      .then(async (coords) => {
        if (!coords) return; // already logged inside geocodeAddress
        await adminDb.collection('bookings').doc(bookingId).update({
          'address.lat': coords.lat,
          'address.lng': coords.lng,
        });
        console.log(`[bookings/create] geocoded ${bookingId} → ${coords.lat}, ${coords.lng}`);
      })
      .catch((err) => console.error('[bookings/create] geocode error:', err));

    return Response.json({ ok: true, bookingId }, { status: 201 });
  } catch (err) {
    console.error('[bookings/create] ERROR:', err);
    return Response.json(
      { ok: false, error: 'booking_failed', message: String(err) },
      { status: 500 },
    );
  }
}
