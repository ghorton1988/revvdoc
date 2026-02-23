/**
 * Vehicle Health Service — Firestore data access for vehicleHealth collection.
 *
 * VehicleHealthSnapshot documents are computed server-side and written by
 * /api/maintenance/recompute after each service completion. This service
 * provides read access only — the client never writes to vehicleHealth directly.
 *
 * Also handles vehicleMetadata (shared make/model/year cache with NHTSA recall data).
 *
 * TODO Phase 3 (Wave 3): implement all function bodies.
 */

import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type {
  VehicleHealthSnapshot,
  VehicleMetadata,
  HealthAlertLevel,
} from '@/types';

const VEHICLE_HEALTH = 'vehicleHealth';
const VEHICLE_METADATA = 'vehicleMetadata';

// ── Vehicle Health Snapshot (read-only) ───────────────────────────────────────

/**
 * Returns the health snapshot for a single vehicle.
 * Returns null if no snapshot has been computed yet (new vehicle, no services).
 */
export async function getVehicleHealth(
  vehicleId: string
): Promise<VehicleHealthSnapshot | null> {
  // TODO Phase 3: implement
  const snap = await getDoc(doc(db, VEHICLE_HEALTH, vehicleId));
  if (!snap.exists()) return null;
  return snap.data() as VehicleHealthSnapshot;
}

/**
 * Returns health snapshots for all of an owner's vehicles that have alerts.
 * Used by the dashboard to show a fleet-level "attention needed" summary.
 * Uses composite index: ownerId ASC, alertLevel ASC.
 * Filter alertLevel != 'none' client-side (three-way enum, simple array check).
 */
export async function getHealthAlertsForOwner(
  ownerId: string
): Promise<VehicleHealthSnapshot[]> {
  // TODO Phase 3: implement
  const ALERT_LEVELS: HealthAlertLevel[] = ['soon', 'overdue'];
  const snapshots: VehicleHealthSnapshot[] = [];

  for (const level of ALERT_LEVELS) {
    const q = query(
      collection(db, VEHICLE_HEALTH),
      where('ownerId', '==', ownerId),
      where('alertLevel', '==', level)
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) => snapshots.push(d.data() as VehicleHealthSnapshot));
  }

  return snapshots;
}

// ── Vehicle Metadata / NHTSA cache ───────────────────────────────────────────

/**
 * Builds the normalized vehicleMetadata document key from make/model/year.
 * Key format: `${year}_${make}_${model}` — lowercase, spaces replaced with underscores.
 */
export function buildMetadataKey(make: string, model: string, year: number): string {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '_');
  return `${year}_${normalize(make)}_${normalize(model)}`;
}

/**
 * Returns the shared vehicle metadata for a make/model/year.
 * This includes the OEM factory maintenance schedule and cached NHTSA recalls.
 * Returns null if the metadata has not yet been fetched from NHTSA.
 */
export async function getVehicleMetadata(
  make: string,
  model: string,
  year: number
): Promise<VehicleMetadata | null> {
  // TODO Phase 3: implement
  const key = buildMetadataKey(make, model, year);
  const snap = await getDoc(doc(db, VEHICLE_METADATA, key));
  if (!snap.exists()) return null;
  return snap.data() as VehicleMetadata;
}

/**
 * Checks whether the cached NHTSA recall data is stale (> 30 days old).
 * If stale or missing, the /api/vehicles/recalls Route Handler should re-fetch.
 */
export function isRecallCacheStale(metadata: VehicleMetadata): boolean {
  if (!metadata.recallsLastChecked) return true;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const checkedAt =
    metadata.recallsLastChecked instanceof Date
      ? metadata.recallsLastChecked
      : (metadata.recallsLastChecked as { toDate(): Date }).toDate();
  return Date.now() - checkedAt.getTime() > thirtyDaysMs;
}
