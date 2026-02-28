/**
 * backfill-booking-coords.mjs
 *
 * One-time backfill: finds accepted/en_route bookings with missing or zero
 * address coordinates and geocodes them using the Google Geocoding API.
 *
 * Safe to run multiple times — skips bookings that already have coords.
 * Rate-limited to 5 requests/second to stay well within API quotas.
 *
 * Usage:
 *   node scripts/backfill-booking-coords.mjs
 *   node scripts/backfill-booking-coords.mjs --dry-run   (preview only, no writes)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const DRY_RUN        = process.argv.includes('--dry-run');
const RATE_LIMIT_MS  = 200; // 5 req/s — well under the 50 req/s Geocoding API limit
const GEOCODE_STATUSES = ['accepted', 'en_route'];

// ── Load .env.local ───────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envLines  = readFileSync(resolve(__dirname, '../.env.local'), 'utf8').split('\n');

for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let   val = trimmed.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

// ── Firebase Admin init ───────────────────────────────────────────────────────
const app = initializeApp({
  credential: cert({
    projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true when coords are present and non-zero. */
function hasCoords(address) {
  return !!(address?.lat && address?.lng);
}

/** Pause for a given number of milliseconds. */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calls Google Geocoding API for the given address string.
 * Retries once on non-OK status or network failure.
 * Returns { lat, lng } or null.
 */
async function geocode(fullAddress, apiKey) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json`
    + `?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`;

  async function attempt() {
    try {
      const res  = await fetch(url);
      const json = await res.json();
      if (json.status === 'OK' && json.results?.length > 0) {
        return json.results[0].geometry.location;
      }
      console.warn(`     [geocode] status "${json.status}"`);
      return null;
    } catch (err) {
      console.error(`     [geocode] fetch error: ${err.message}`);
      return null;
    }
  }

  const first = await attempt();
  if (first) return first;

  console.warn(`     [geocode] retrying...`);
  await sleep(500);
  return attempt();
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (DRY_RUN) console.log('\n⚠️  DRY RUN — no writes will be made\n');

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
if (!apiKey) {
  console.error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set in .env.local');
  process.exit(1);
}

// 1. Fetch all accepted + en_route bookings in one query
console.log('[1/3] Querying bookings with status: accepted, en_route...');

const snap = await db
  .collection('bookings')
  .where('status', 'in', GEOCODE_STATUSES)
  .get();

console.log(`      Found ${snap.docs.length} total booking(s)`);

// 2. Filter client-side for missing/zero coords.
//    Skip bookings with a null/incomplete address — nothing to geocode.
const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

const needsGeocode = allDocs.filter(b =>
  b.address?.street &&   // address object exists and has a street
  !hasCoords(b.address)  // but coords are missing or zero
);

const noAddress = allDocs.filter(b => !b.address?.street);

const alreadyHasCoords = snap.docs.length - needsGeocode.length;

console.log(`      ${alreadyHasCoords} already have coords — skipping`);
if (noAddress.length > 0)
  console.log(`      ${noAddress.length} have no address — skipping (${noAddress.map(b => b.id).join(', ')})`);
console.log(`      ${needsGeocode.length} need geocoding`);

if (needsGeocode.length === 0) {
  console.log('\nNothing to do. All bookings already have coordinates.\n');
  process.exit(0);
}

// 3. Geocode and write — rate limited
console.log(`\n[2/3] Geocoding ${needsGeocode.length} booking(s) at ${1000 / RATE_LIMIT_MS} req/s...\n`);

const results = { ok: 0, failed: 0, skipped: 0 };

for (const [index, booking] of needsGeocode.entries()) {
  const addr = booking.address;
  const fullAddress = `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`;

  console.log(`  [${index + 1}/${needsGeocode.length}] ${booking.id}`);
  console.log(`     status:  ${booking.status}`);
  console.log(`     address: ${fullAddress}`);
  console.log(`     current coords: lat=${addr.lat ?? 'null'}, lng=${addr.lng ?? 'null'}`);

  const coords = await geocode(fullAddress, apiKey);

  if (!coords) {
    console.error(`     ✗ geocoding failed — skipping write`);
    results.failed++;
  } else if (DRY_RUN) {
    console.log(`     ✓ [DRY RUN] would write lat=${coords.lat}, lng=${coords.lng}`);
    results.skipped++;
  } else {
    try {
      await db.collection('bookings').doc(booking.id).update({
        'address.lat': coords.lat,
        'address.lng': coords.lng,
      });
      console.log(`     ✓ wrote lat=${coords.lat}, lng=${coords.lng}`);
      results.ok++;
    } catch (err) {
      console.error(`     ✗ Firestore write failed: ${err.message}`);
      results.failed++;
    }
  }

  // Rate limit: pause before next request (skip delay after last item)
  if (index < needsGeocode.length - 1) {
    await sleep(RATE_LIMIT_MS);
  }
}

// 4. Summary
console.log('\n[3/3] Summary');
console.log('─────────────────────────────────────────');
console.log(`  Total bookings queried:     ${snap.docs.length}`);
console.log(`  Already had coords:         ${alreadyHasCoords}`);
console.log(`  No address (skipped):       ${noAddress.length}`);
console.log(`  Geocoded successfully:      ${results.ok}`);
if (DRY_RUN)
  console.log(`  Would have written (dry):   ${results.skipped}`);
console.log(`  Failed:                     ${results.failed}`);
if (results.failed > 0)
  console.log(`\n  ⚠  Re-run the script to retry failed bookings.`);
if (DRY_RUN)
  console.log(`\n  Remove --dry-run to apply writes.`);
console.log('');
