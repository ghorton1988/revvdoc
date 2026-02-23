/**
 * GET /api/weather?lat=<lat>&lon=<lon>&vehicleId=<id>
 *
 * Returns current weather conditions + risk flags for a location.
 * Uses Open-Meteo (https://open-meteo.com) — free, no API key required.
 *
 * If vehicleId is provided, saves the WeatherSnapshot to
 * vehicles/{vehicleId}.lastWeather in Firestore (non-blocking).
 *
 * Query params:
 *   lat       — latitude  (required)
 *   lon       — longitude (required)
 *   vehicleId — Firestore vehicle doc ID (optional; enables saving to vehicle)
 *
 * Returns: WeatherSnapshot
 *
 * Auth: Firebase ID token required.
 */

import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/firebaseAdmin';
import { fetchWeather } from '@/lib/weather/weather';

export const runtime = 'nodejs';

const querySchema = z.object({
  lat:       z.coerce.number().min(-90).max(90),
  lon:       z.coerce.number().min(-180).max(180),
  vehicleId: z.string().min(1).optional(),
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
    lat:       searchParams.get('lat'),
    lon:       searchParams.get('lon'),
    vehicleId: searchParams.get('vehicleId') ?? undefined,
  });

  if (!parseResult.success) {
    return Response.json(
      { error: 'Invalid query params', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { lat, lon, vehicleId } = parseResult.data;

  // 3. Fetch weather (always fresh — no cache, weather changes)
  let snapshot;
  try {
    snapshot = await fetchWeather(lat, lon);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Weather fetch failed';
    console.error('[api/weather] error:', err);
    return Response.json({ error: message }, { status: 502 });
  }

  // 4. Optionally save to vehicle doc (fire-and-forget, non-blocking)
  if (vehicleId) {
    // Verify ownership before writing
    adminDb.collection('vehicles').doc(vehicleId).get().then(async (snap) => {
      if (!snap.exists || snap.data()?.ownerId !== decodedToken.uid) return;
      await adminDb.collection('vehicles').doc(vehicleId).update({
        lastWeather: snapshot,
      });
    }).catch((err) => {
      console.error('[api/weather] vehicle update error:', err);
    });
  }

  return Response.json(snapshot);
}
