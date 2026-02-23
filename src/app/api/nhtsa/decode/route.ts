/**
 * GET /api/nhtsa/decode?vin=<VIN>&vehicleId=<id>
 *
 * Decodes a VIN using the NHTSA vpic free API.
 * Caches the decoded result in vehicles/{vehicleId} for 7 days.
 *
 * On cache hit (fresh), returns the stored decoded data without fetching NHTSA.
 * On cache miss or stale, fetches NHTSA and updates the vehicle document.
 *
 * Query params:
 *   vin        — 17-char VIN (required)
 *   vehicleId  — Firestore vehicle document ID (required for caching)
 *
 * Returns: { source: 'cache'|'nhtsa', make, model, year, vehicleType, raw }
 *
 * Auth: Firebase ID token required. Caller must own the vehicle or be admin.
 */

import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/firebaseAdmin';
import { isNhtsaCacheStale } from '@/lib/nhtsa/nhtsa';

export const runtime = 'nodejs';

const querySchema = z.object({
  vin:       z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'Invalid VIN format'),
  vehicleId: z.string().min(1),
});

export async function GET(request: Request) {
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

  // 2. Validate query params
  const { searchParams } = new URL(request.url);
  const parseResult = querySchema.safeParse({
    vin:       searchParams.get('vin')?.toUpperCase().replace(/\s/g, ''),
    vehicleId: searchParams.get('vehicleId'),
  });

  if (!parseResult.success) {
    return Response.json(
      { error: 'Invalid query params', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { vin, vehicleId } = parseResult.data;

  // 3. Verify vehicle ownership
  const vehicleSnap = await adminDb.collection('vehicles').doc(vehicleId).get();
  if (!vehicleSnap.exists || vehicleSnap.data()?.ownerId !== decodedToken.uid) {
    // Check admin
    const userSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== 'admin') {
      return Response.json({ error: 'Forbidden — not your vehicle' }, { status: 403 });
    }
  }

  const vehicleData = vehicleSnap.data();

  // 4. Cache check (7-day TTL)
  const lastFetched: Date | null = vehicleData?.nhtsaLastFetchedAt
    ? (typeof vehicleData.nhtsaLastFetchedAt.toDate === 'function'
        ? vehicleData.nhtsaLastFetchedAt.toDate()
        : new Date(vehicleData.nhtsaLastFetchedAt))
    : null;

  if (!isNhtsaCacheStale(lastFetched) && vehicleData?.nhtsaDecoded) {
    return Response.json({
      source:    'cache',
      vehicleId,
      decoded:   vehicleData.nhtsaDecoded,
      recalls:   vehicleData.nhtsaRecalls ?? [],
      cachedAt:  lastFetched?.toISOString(),
    });
  }

  // 5. Fetch from NHTSA and update vehicle doc
  try {
    const { decoded, recalls } = await import('@/lib/nhtsa/nhtsa').then(
      async (m) => m.refreshNhtsaForVehicle(vehicleId, vin)
    );

    return Response.json({
      source:    'nhtsa',
      vehicleId,
      decoded:   decoded.raw,
      recalls,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'NHTSA decode failed';
    console.error('[nhtsa/decode] error:', err);
    return Response.json({ error: message }, { status: 502 });
  }
}
