/**
 * GET /api/vehicles/factory-schedule?vehicleId=<id>
 *
 * Returns a baseline OEM-style factory maintenance schedule for a vehicle.
 * Generated from the vehicle's year and NHTSA decoded fields (fuel type).
 * Cached in vehicles/{vehicleId}.factorySchedule for 30 days.
 *
 * Query params:
 *   vehicleId — Firestore vehicle document ID (required)
 *
 * Returns:
 * {
 *   vehicleId: string;
 *   source: 'cache' | 'generated';
 *   schedule: FactoryMaintenanceItem[];
 *   cachedAt?: string;     // ISO string — present when source = 'cache'
 *   generatedAt?: string;  // ISO string — present when source = 'generated'
 * }
 *
 * Auth: Firebase ID token required. Caller must own the vehicle.
 */

import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/firebaseAdmin';
import type { FactoryMaintenanceItem } from '@/types';

export const runtime = 'nodejs';

/** 30-day cache TTL for factory schedules. */
const SCHEDULE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const querySchema = z.object({
  vehicleId: z.string().min(1),
});

// ── Schedule generator ────────────────────────────────────────────────────────

/**
 * Generates a baseline factory maintenance schedule from vehicle metadata.
 * Adjusts intervals based on model year and NHTSA fuel type (electric/hybrid).
 */
function generateSchedule(
  year: number,
  nhtsaDecoded?: Record<string, string> | null
): FactoryMaintenanceItem[] {
  const fuelRaw = (nhtsaDecoded?.['Fuel Type - Primary'] ?? '').toLowerCase();
  const isElectric = fuelRaw.includes('electric') && !fuelRaw.includes('hybrid');
  const isHybrid   = fuelRaw.includes('hybrid');
  const isNewish   = year >= 2015;
  const isSyntheticEra = year >= 2010;

  const items: FactoryMaintenanceItem[] = [];

  // Engine oil & filter (ICE + hybrid only)
  if (!isElectric) {
    items.push({
      service: 'Engine Oil & Filter',
      intervalMiles:  isNewish ? 10000 : isSyntheticEra ? 7500 : 5000,
      intervalMonths: isNewish ? 12    : 6,
      notes: isNewish ? 'Full synthetic oil recommended' : null,
    });
  }

  // Tire rotation + pressure check (all vehicles)
  items.push({
    service: 'Tire Rotation & Pressure Check',
    intervalMiles:  7500,
    intervalMonths: 6,
    notes: null,
  });

  // Engine air filter (ICE + hybrid only)
  if (!isElectric) {
    items.push({
      service: 'Engine Air Filter',
      intervalMiles:  isNewish ? 30000 : 20000,
      intervalMonths: isNewish ? 36    : 24,
      notes: 'Replace sooner in dusty or high-pollution areas',
    });
  }

  // Cabin air filter (all vehicles)
  items.push({
    service: 'Cabin Air Filter',
    intervalMiles:  15000,
    intervalMonths: 12,
    notes: null,
  });

  // Brake inspection (all vehicles)
  items.push({
    service: 'Brake Inspection',
    intervalMiles:  20000,
    intervalMonths: 24,
    notes: 'Replace pads when < 3 mm remaining',
  });

  // ICE-only services
  if (!isElectric && !isHybrid) {
    // Coolant flush
    items.push({
      service: 'Engine Coolant Flush',
      intervalMiles:  30000,
      intervalMonths: 36,
      notes: null,
    });

    // Transmission fluid
    items.push({
      service: 'Transmission Fluid',
      intervalMiles:  isNewish ? 60000 : 45000,
      intervalMonths: isNewish ? 72    : 60,
      notes: "Check owner's manual for CVT-specific interval",
    });

    // Spark plugs
    items.push({
      service: 'Spark Plugs',
      intervalMiles:  isNewish ? 100000 : 30000,
      intervalMonths: isNewish ? 120    : 36,
      notes: isNewish
        ? 'Iridium/platinum — extended life'
        : 'Replace at interval or if misfiring',
    });
  }

  // Wiper blades (all vehicles)
  items.push({
    service: 'Wiper Blades',
    intervalMiles:  12000,
    intervalMonths: 12,
    notes: 'Replace when streaking or skipping',
  });

  return items;
}

// ── Route handler ─────────────────────────────────────────────────────────────

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
  const parseResult = querySchema.safeParse({ vehicleId: searchParams.get('vehicleId') });
  if (!parseResult.success) {
    return Response.json({ error: 'vehicleId is required' }, { status: 400 });
  }

  const { vehicleId } = parseResult.data;

  // 3. Verify vehicle ownership
  const vehicleSnap = await adminDb.collection('vehicles').doc(vehicleId).get();
  if (!vehicleSnap.exists || vehicleSnap.data()?.ownerId !== decodedToken.uid) {
    return Response.json({ error: 'Forbidden — not your vehicle' }, { status: 403 });
  }

  const vehicleData = vehicleSnap.data()!;

  // 4. Cache check (30 days)
  const rawTs = vehicleData.factoryScheduleLastFetchedAt;
  const lastFetched: Date | null = rawTs
    ? (typeof rawTs.toDate === 'function' ? rawTs.toDate() : new Date(rawTs))
    : null;

  const isStale =
    !lastFetched ||
    Date.now() - lastFetched.getTime() > SCHEDULE_TTL_MS;

  if (
    !isStale &&
    Array.isArray(vehicleData.factorySchedule) &&
    vehicleData.factorySchedule.length > 0
  ) {
    return Response.json({
      source:    'cache',
      vehicleId,
      schedule:  vehicleData.factorySchedule as FactoryMaintenanceItem[],
      cachedAt:  lastFetched!.toISOString(),
    });
  }

  // 5. Generate schedule from vehicle metadata
  const year: number = vehicleData.year ?? 0;
  const nhtsaDecoded: Record<string, string> | null = vehicleData.nhtsaDecoded ?? null;
  const schedule = generateSchedule(year, nhtsaDecoded);

  // 6. Persist to Firestore (fire-and-forget)
  adminDb.collection('vehicles').doc(vehicleId).update({
    factorySchedule:                 schedule,
    factoryScheduleLastFetchedAt:    FieldValue.serverTimestamp(),
  }).catch((err) => console.error('[factory-schedule] Firestore update error:', err));

  return Response.json({
    source:      'generated',
    vehicleId,
    schedule,
    generatedAt: new Date().toISOString(),
  });
}
