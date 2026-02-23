/**
 * GET /api/vehicles/recalls?make=Toyota&model=Camry&year=2020
 *
 * Returns active NHTSA safety recalls for a vehicle make/model/year.
 * Results are cached in vehicleMetadata/{key} for 30 days.
 * On cache hit (fresh), returns cached data immediately — no NHTSA call.
 * On cache miss or stale, fetches NHTSA Complaints & Recalls API (no API key needed),
 * writes the result back to Firestore, then returns the fresh data.
 *
 * Auth: Firebase ID token required (recall data is not sensitive, but we
 * want to ensure authenticated users only — rules mirror vehicleMetadata).
 *
 * NHTSA endpoint: https://api.nhtsa.gov/recalls/recallsByVehicle
 * Documentation: https://api.nhtsa.gov/
 */

import { adminAuth, adminDb } from '@/lib/firebase/firebaseAdmin';
import type { RecallRecord } from '@/types';

export const runtime = 'nodejs';

/** Normalizes a string for use in vehicleMetadata document keys. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '_');
}

/** Builds the vehicleMetadata document key. */
function buildMetadataKey(make: string, model: string, year: number): string {
  return `${year}_${normalize(make)}_${normalize(model)}`;
}

/** 30-day TTL in milliseconds. */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Parses the NHTSA /Date(timestamp)/ date format.
 * Returns null for any value that cannot be parsed.
 */
function parseNhtsaDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const match = raw.match(/\/Date\((-?\d+)\)\//);
  if (match) return new Date(parseInt(match[1], 10));
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  // 1. Auth — require signed-in user
  const authorization = request.headers.get('Authorization') ?? '';
  const idToken = authorization.replace('Bearer ', '');
  if (!idToken) {
    return Response.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  try {
    await adminAuth.verifyIdToken(idToken);
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }

  // 2. Parse + validate query params
  const { searchParams } = new URL(request.url);
  const make = searchParams.get('make')?.trim() ?? '';
  const model = searchParams.get('model')?.trim() ?? '';
  const yearRaw = searchParams.get('year') ?? '';
  const year = parseInt(yearRaw, 10);

  if (!make || !model || isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1) {
    return Response.json(
      { error: 'Missing or invalid query params: make, model, year required' },
      { status: 400 }
    );
  }

  const metadataKey = buildMetadataKey(make, model, year);
  const metadataRef = adminDb.collection('vehicleMetadata').doc(metadataKey);

  // 3. Check cache
  const cached = await metadataRef.get();
  if (cached.exists) {
    const data = cached.data()!;
    const lastChecked: Date | null =
      data.recallsLastChecked
        ? (typeof data.recallsLastChecked.toDate === 'function'
            ? data.recallsLastChecked.toDate()
            : new Date(data.recallsLastChecked))
        : null;

    const isFresh = lastChecked !== null && Date.now() - lastChecked.getTime() < THIRTY_DAYS_MS;
    if (isFresh) {
      return Response.json({
        source: 'cache',
        recalls: data.recalls ?? [],
        lastChecked: lastChecked.toISOString(),
      });
    }
  }

  // 4. Fetch from NHTSA
  const nhtsaUrl = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;

  let nhtsaData: { Count: number; results: NhtsaRecall[] };
  try {
    const res = await fetch(nhtsaUrl, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 }, // never use Next.js fetch cache — we cache in Firestore
    });
    if (!res.ok) {
      throw new Error(`NHTSA responded with ${res.status}`);
    }
    nhtsaData = await res.json();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'NHTSA fetch failed';
    console.error('[vehicles/recalls] NHTSA fetch error:', err);
    // If we have stale cached data, return it rather than erroring
    if (cached.exists) {
      const staleData = cached.data()!;
      return Response.json({
        source: 'stale_cache',
        recalls: staleData.recalls ?? [],
        warning: `NHTSA unavailable (${message}) — returning cached data`,
      });
    }
    return Response.json({ error: `NHTSA service unavailable: ${message}` }, { status: 502 });
  }

  // 5. Map NHTSA results → RecallRecord[]
  const recalls: RecallRecord[] = (nhtsaData.results ?? []).map((r) => ({
    nhtsaId: r.NHTSACampaignNumber ?? '',
    component: r.Component ?? '',
    summary: r.Summary ?? '',
    consequence: r.Consequence ?? null,
    remedy: r.Remedy ?? null,
    reportDate: parseNhtsaDate(r.ReportReceivedDate) ?? new Date(0),
  }));

  // 6. Write/update vehicleMetadata cache
  const now = new Date();
  try {
    await metadataRef.set(
      {
        key: metadataKey,
        make,
        model,
        year,
        recalls,
        recallsLastChecked: now,
        // Preserve existing factorySchedule if present; set [] on first write
        ...( !cached.exists ? { factorySchedule: [], createdAt: now } : {} ),
        updatedAt: now,
      },
      { merge: true }
    );
  } catch (err) {
    console.error('[vehicles/recalls] vehicleMetadata write error:', err);
    // Non-critical — return fresh data even if cache write fails
  }

  return Response.json({
    source: 'nhtsa',
    recalls,
    lastChecked: now.toISOString(),
  });
}

// ── NHTSA API response shape ────────────────────────────────────────────────

interface NhtsaRecall {
  NHTSACampaignNumber?: string;
  Component?: string;
  Summary?: string;
  Consequence?: string;
  Remedy?: string;
  ReportReceivedDate?: string;
}
