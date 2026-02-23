/**
 * GET /api/nhtsa/recalls?vin=<VIN>&vehicleId=<id>
 *
 * Returns active NHTSA safety recalls for a vehicle identified by VIN.
 * Caches results in vehicles/{vehicleId} for 7 days (shared with decode cache).
 *
 * Flow:
 *  1. Check vehicles/{vehicleId}.nhtsaLastFetchedAt — if < 7 days, return cached nhtsaRecalls
 *  2. Otherwise: decode VIN → get make/model/year → fetch recalls → update vehicle doc
 *
 * Query params:
 *   vin        — 17-char VIN (required)
 *   vehicleId  — Firestore vehicle document ID (required for caching)
 *
 * Returns: { source: 'cache'|'nhtsa', recalls: RecallRecord[], count: number }
 *
 * Auth: Firebase ID token required. Caller must own the vehicle or be admin.
 */

import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/firebaseAdmin';
import { refreshNhtsaForVehicle, isNhtsaCacheStale } from '@/lib/nhtsa/nhtsa';
import type { RecallRecord } from '@/types';

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
    const userSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== 'admin') {
      return Response.json({ error: 'Forbidden — not your vehicle' }, { status: 403 });
    }
  }

  const vehicleData = vehicleSnap.data();

  // 4. Cache check
  const lastFetched: Date | null = vehicleData?.nhtsaLastFetchedAt
    ? (typeof vehicleData.nhtsaLastFetchedAt.toDate === 'function'
        ? vehicleData.nhtsaLastFetchedAt.toDate()
        : new Date(vehicleData.nhtsaLastFetchedAt))
    : null;

  if (!isNhtsaCacheStale(lastFetched) && vehicleData?.nhtsaRecalls !== undefined) {
    const recalls: RecallRecord[] = vehicleData.nhtsaRecalls ?? [];
    return Response.json({
      source:   'cache',
      vehicleId,
      recalls,
      count:    recalls.length,
      cachedAt: lastFetched?.toISOString(),
    });
  }

  // 5. Fetch from NHTSA (decode VIN first to get make/model/year, then recalls)
  try {
    const { recalls } = await refreshNhtsaForVehicle(vehicleId, vin);

    return Response.json({
      source:    'nhtsa',
      vehicleId,
      recalls,
      count:     recalls.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'NHTSA recalls fetch failed';
    console.error('[nhtsa/recalls] error:', err);

    // Graceful degradation: return stale data if available
    if (vehicleData?.nhtsaRecalls) {
      return Response.json({
        source:  'stale_cache',
        vehicleId,
        recalls: vehicleData.nhtsaRecalls,
        count:   vehicleData.nhtsaRecalls.length,
        warning: `NHTSA unavailable (${message}) — returning cached data`,
      });
    }

    return Response.json({ error: message }, { status: 502 });
  }
}
