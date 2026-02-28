/**
 * accept-pending-booking.mjs
 *
 * One-shot script: finds the latest pending booking, runs the same
 * transaction as PATCH /api/bookings/status with status=accepted.
 *
 * Prints the resulting booking doc, job doc, and jobId.
 *
 * Usage:
 *   node scripts/accept-pending-booking.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env.local manually ─────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = resolve(__dirname, '../.env.local');
const envLines  = readFileSync(envPath, 'utf8').split('\n');

for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let   val = trimmed.slice(eq + 1).trim();
  // Strip surrounding quotes
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

const DEMO_TECH_ID = 'demo-tech-1';

// ── Find latest pending booking ───────────────────────────────────────────────
console.log('\n[1/4] Querying for pending bookings...');
const pendingSnap = await db
  .collection('bookings')
  .where('status', '==', 'pending')
  .get();

if (pendingSnap.empty) {
  console.error('No pending bookings found. Create a booking first.');
  process.exit(1);
}

// Sort client-side by createdAt DESC to get latest
const pendingDocs = pendingSnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .sort((a, b) => {
    const aTime = a.createdAt?.toDate?.()?.getTime() ?? 0;
    const bTime = b.createdAt?.toDate?.()?.getTime() ?? 0;
    return bTime - aTime;
  });

const latest   = pendingDocs[0];
const bookingId = latest.id;

console.log(`   Found ${pendingDocs.length} pending booking(s). Using latest: ${bookingId}`);
console.log(`   Customer: ${latest.customerId}`);
console.log(`   Service:  ${latest.serviceSnapshot?.name ?? '(unknown)'}`);
console.log(`   Status:   ${latest.status}`);

// ── Idempotency guard ─────────────────────────────────────────────────────────
if (latest.jobId) {
  console.log(`\n[SKIP] Booking already has jobId: ${latest.jobId}`);
  process.exit(0);
}

// ── Atomic transaction: create job + stamp booking ────────────────────────────
console.log('\n[2/4] Running transaction...');

const jobRef   = db.collection('jobs').doc();
const newJobId = jobRef.id;
const bookingRef = db.collection('bookings').doc(bookingId);

await db.runTransaction(async (tx) => {
  tx.set(jobRef, {
    bookingId,
    technicianId: DEMO_TECH_ID,
    customerId:   latest.customerId,
    status:       'accepted',
    currentStage: 'dispatched',
    stages:       [],
    techLocation: null,
    route:        null,
    etaMinutes:   null,
    notes:        null,
    startedAt:    null,
    completedAt:  null,
    createdAt:    FieldValue.serverTimestamp(),
    updatedAt:    FieldValue.serverTimestamp(),
  });

  tx.update(bookingRef, {
    status:       'accepted',
    technicianId: DEMO_TECH_ID,
    jobId:        newJobId,
    updatedAt:    FieldValue.serverTimestamp(),
  });
});

console.log(`JOB CREATED FOR BOOKING ${bookingId}: ${newJobId}`);

// ── Read back and display results ─────────────────────────────────────────────
console.log('\n[3/4] Reading back documents...');

const [updatedBookingSnap, jobSnap] = await Promise.all([
  db.collection('bookings').doc(bookingId).get(),
  db.collection('jobs').doc(newJobId).get(),
]);

const booking = updatedBookingSnap.data();
const job     = jobSnap.data();

// Helper: convert Firestore Timestamps to ISO strings for display
function serialize(obj) {
  if (!obj) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (v && typeof v.toDate === 'function') return [k, v.toDate().toISOString()];
      return [k, v];
    })
  );
}

console.log('\n[4/4] Results:\n');
console.log('── BOOKING DOCUMENT (' + bookingId + ') ──────────────────────');
console.log(JSON.stringify(serialize(booking), null, 2));

console.log('\n── JOB DOCUMENT (' + newJobId + ') ───────────────────────────');
console.log(JSON.stringify(serialize(job), null, 2));

console.log('\n── SUMMARY ──────────────────────────────────────────────────');
console.log('bookingId:    ', bookingId);
console.log('jobId:        ', booking.jobId);
console.log('technicianId: ', booking.technicianId);
console.log('status:       ', booking.status);
console.log('');
