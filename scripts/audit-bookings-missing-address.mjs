/**
 * audit-bookings-missing-address.mjs
 *
 * Finds all bookings where address is null or lacks a street field.
 * Logs each one with full details for manual review.
 *
 * With --delete: permanently deletes the listed bookings (test cleanup only).
 * With --status=<value>: restricts deletion to a specific status (e.g. 'pending').
 *
 * Usage:
 *   node scripts/audit-bookings-missing-address.mjs            # audit only
 *   node scripts/audit-bookings-missing-address.mjs --delete   # delete all missing-address bookings
 *   node scripts/audit-bookings-missing-address.mjs --delete --status=pending   # delete only pending
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const DELETE_MODE   = process.argv.includes('--delete');
const STATUS_FILTER = process.argv.find(a => a.startsWith('--status='))?.split('=')[1] ?? null;

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

function hasAddress(booking) {
  return !!(booking.address?.street);
}

function formatDate(ts) {
  return ts?.toDate?.()?.toISOString?.() ?? String(ts ?? '—');
}

// ── Fetch all bookings ────────────────────────────────────────────────────────
console.log('\n[1/3] Fetching all bookings...');

const snap = await db.collection('bookings').get();
const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

console.log(`      Total bookings: ${allDocs.length}`);

// ── Classify ──────────────────────────────────────────────────────────────────
const missing = allDocs.filter(b => !hasAddress(b));
const healthy = allDocs.filter(b =>  hasAddress(b));

console.log(`      With address:    ${healthy.length}`);
console.log(`      Missing address: ${missing.length}`);

// ── Report ────────────────────────────────────────────────────────────────────
console.log('\n[2/3] Bookings missing address:\n');

if (missing.length === 0) {
  console.log('  None — all bookings have an address.\n');
} else {
  for (const b of missing) {
    console.log(`  ID:       ${b.id}`);
    console.log(`  Status:   ${b.status}`);
    console.log(`  Customer: ${b.customerId}`);
    console.log(`  Service:  ${b.serviceSnapshot?.name ?? '(unknown)'}`);
    console.log(`  Created:  ${formatDate(b.createdAt)}`);
    console.log(`  address:  ${JSON.stringify(b.address)}`);
    console.log('  ─────────────────────────────────────────');
  }
}

// ── Delete (optional) ─────────────────────────────────────────────────────────
console.log('[3/3] Delete mode:', DELETE_MODE ? 'ON' : 'OFF (pass --delete to enable)');

if (!DELETE_MODE) {
  if (missing.length > 0) {
    console.log(`\n  To delete all ${missing.length} listed booking(s):`);
    console.log('    node scripts/audit-bookings-missing-address.mjs --delete');
    console.log('\n  To delete only pending bookings:');
    console.log('    node scripts/audit-bookings-missing-address.mjs --delete --status=pending');
  }
  console.log('');
  process.exit(0);
}

// Determine targets for deletion
const targets = STATUS_FILTER
  ? missing.filter(b => b.status === STATUS_FILTER)
  : missing;

if (targets.length === 0) {
  const qualifier = STATUS_FILTER ? ` with status "${STATUS_FILTER}"` : '';
  console.log(`\n  No bookings missing address${qualifier} to delete.\n`);
  process.exit(0);
}

const qualifier = STATUS_FILTER ? ` with status "${STATUS_FILTER}"` : '';
console.log(`\n  Deleting ${targets.length} booking(s) missing address${qualifier}...`);

let deleted = 0;
let failed  = 0;

for (const b of targets) {
  try {
    await db.collection('bookings').doc(b.id).delete();
    console.log(`  ✓ deleted ${b.id} (${b.status} — ${b.serviceSnapshot?.name ?? 'unknown'})`);
    deleted++;
  } catch (err) {
    console.error(`  ✗ failed to delete ${b.id}: ${err.message}`);
    failed++;
  }
}

console.log('\n── Summary ──────────────────────────────────────────────────');
console.log(`  Total bookings:       ${allDocs.length}`);
console.log(`  Missing address:      ${missing.length}`);
console.log(`  Deleted:              ${deleted}`);
if (failed > 0)
  console.log(`  Failed to delete:     ${failed}`);
console.log('');
