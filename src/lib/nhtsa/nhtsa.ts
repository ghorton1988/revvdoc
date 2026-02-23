/**
 * NHTSA server-side helper — server-only (used in Route Handlers only).
 *
 * Provides:
 *  - decodeVin()         — NHTSA VIN decode API (vpic.nhtsa.dot.gov)
 *  - fetchRecalls()      — NHTSA recalls API (api.nhtsa.gov)
 *  - refreshNhtsaForVehicle() — fetches both decode + recalls and writes
 *                              them to vehicles/{vehicleId} in Firestore.
 *
 * Cache TTL: 7 days per vehicle document.
 * NHTSA APIs are free — no API key required.
 *
 * IMPORTANT: server-only. Never import in components or hooks.
 */

import { adminDb } from '@/lib/firebase/firebaseAdmin';
import type { RecallRecord } from '@/types';

// ── Constants ────────────────────────────────────────────────────────────────

const NHTSA_DECODE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/decodevin';
const NHTSA_RECALLS_URL = 'https://api.nhtsa.gov/recalls/recallsByVehicle';

/** 7 days in milliseconds — shared cache TTL for both decode and recalls. */
export const NHTSA_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── Types ────────────────────────────────────────────────────────────────────

export interface NhtsaDecodeResult {
  vin: string;
  make: string;
  model: string;
  year: number;
  vehicleType: string;
  /** Full flat-format field map from NHTSA (Variable → Value). */
  raw: Record<string, string>;
}

interface NhtsaResultItem {
  Variable: string;
  Value: string | null;
}

interface NhtsaRecallItem {
  NHTSACampaignNumber?: string;
  Component?: string;
  Summary?: string;
  Consequence?: string;
  Remedy?: string;
  ReportReceivedDate?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getField(results: NhtsaResultItem[], variable: string): string {
  return results.find((r) => r.Variable === variable)?.Value ?? '';
}

/** Parses NHTSA's /Date(timestamp)/ format. */
function parseNhtsaDate(raw: string | null | undefined): Date {
  if (!raw) return new Date(0);
  const match = raw.match(/\/Date\((-?\d+)\)\//);
  if (match) return new Date(parseInt(match[1], 10));
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Decodes a VIN using the NHTSA vpic free API.
 * Throws on network failure or unrecognized VIN.
 */
export async function decodeVin(vin: string): Promise<NhtsaDecodeResult> {
  const url = `${NHTSA_DECODE_URL}/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    throw new Error(`NHTSA decode returned ${res.status}`);
  }

  const data = await res.json();
  const results: NhtsaResultItem[] = data.Results ?? [];

  const make  = getField(results, 'Make');
  const model = getField(results, 'Model');
  const year  = parseInt(getField(results, 'Model Year'), 10);
  const vehicleType = getField(results, 'Vehicle Type');

  if (!make || !model || !year) {
    throw new Error('VIN not recognized by NHTSA');
  }

  const raw: Record<string, string> = {};
  for (const item of results) {
    if (item.Variable && item.Value !== null && item.Value !== '') {
      raw[item.Variable] = item.Value;
    }
  }

  return { vin, make, model, year, vehicleType, raw };
}

/**
 * Fetches active safety recalls for a make/model/year from the NHTSA API.
 * Returns an empty array on network failure — never throws.
 */
export async function fetchRecalls(
  make: string,
  model: string,
  year: number
): Promise<RecallRecord[]> {
  const url =
    `${NHTSA_RECALLS_URL}?make=${encodeURIComponent(make)}` +
    `&model=${encodeURIComponent(model)}&modelYear=${year}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return (data.results ?? []).map((r: NhtsaRecallItem): RecallRecord => ({
      nhtsaId:    r.NHTSACampaignNumber ?? '',
      component:  r.Component ?? '',
      summary:    r.Summary ?? '',
      consequence: r.Consequence ?? null,
      remedy:     r.Remedy ?? null,
      reportDate: parseNhtsaDate(r.ReportReceivedDate),
    }));
  } catch {
    return [];
  }
}

/**
 * Fetches NHTSA decode + recalls for a vehicle and writes them to
 * vehicles/{vehicleId} in Firestore.
 *
 * Called:
 *  1. After a vehicle is added (POST /api/nhtsa/decode trigger)
 *  2. On demand from /api/nhtsa/decode and /api/nhtsa/recalls when cache is stale
 *
 * Fire-and-forget safe — callers may .catch(console.error) and not await.
 */
export async function refreshNhtsaForVehicle(
  vehicleId: string,
  vin: string
): Promise<{ decoded: NhtsaDecodeResult; recalls: RecallRecord[] }> {
  const decoded  = await decodeVin(vin);
  const recalls  = await fetchRecalls(decoded.make, decoded.model, decoded.year);
  const now      = new Date();

  await adminDb.collection('vehicles').doc(vehicleId).update({
    nhtsaDecoded:       decoded.raw,
    nhtsaRecalls:       recalls,
    nhtsaLastFetchedAt: now,
  });

  return { decoded, recalls };
}

/**
 * Returns true if the vehicle's cached NHTSA data is stale (> 7 days old
 * or never fetched).
 */
export function isNhtsaCacheStale(nhtsaLastFetchedAt: Date | null | undefined): boolean {
  if (!nhtsaLastFetchedAt) return true;
  return Date.now() - nhtsaLastFetchedAt.getTime() > NHTSA_TTL_MS;
}
