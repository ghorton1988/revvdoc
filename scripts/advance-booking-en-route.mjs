/**
 * advance-booking-en-route.mjs
 *
 * Finds the latest accepted booking, then atomically:
 *   1. Sets booking.status = 'en_route'
 *   2. Sets job.currentStage = 'en_route' + appends to job.stages[]
 *
 * Usage:
 *   node scripts/advance-booking-en-route.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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

// ── Find latest accepted booking ──────────────────────────────────────────────
console.log('\n[1/4] Querying for accepted bookings...');
const snap = await db.collection('bookings').where('status', '==', 'accepted').get();

if (snap.empty) {
  console.error('No accepted bookings found.');
  process.exit(1);
}

const docs = snap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .sort((a, b) => {
    const aTime = a.updatedAt?.toDate?.()?.getTime() ?? 0;
    const bTime = b.updatedAt?.toDate?.()?.getTime() ?? 0;
    return bTime - aTime;
  });

const booking   = docs[0];
const bookingId = booking.id;
const jobId     = booking.jobId;

console.log(`   Found ${docs.length} accepted booking(s). Using: ${bookingId}`);
console.log(`   Service:     ${booking.serviceSnapshot?.name ?? '(unknown)'}`);
console.log(`   jobId:       ${jobId ?? '(none)'}`);
console.log(`   technicianId: ${booking.technicianId ?? '(none)'}`);

if (!jobId) {
  console.error('Booking has no jobId — run accept-pending-booking.mjs first.');
  process.exit(1);
}

// ── Atomic: update booking status + job currentStage ─────────────────────────
console.log('\n[2/4] Running transaction (booking + job)...');

const bookingRef = db.collection('bookings').doc(bookingId);
const jobRef     = db.collection('jobs').doc(jobId);

// Note: serverTimestamp() cannot be used inside arrayUnion elements —
// Firestore rejects it. Use a plain Date instead.
const stageRecord = {
  stage:     'en_route',
  enteredAt: new Date(),
  note:      null,
};

await db.runTransaction(async (tx) => {
  tx.update(bookingRef, {
    status:    'en_route',
    updatedAt: FieldValue.serverTimestamp(),
  });

  tx.update(jobRef, {
    currentStage: 'en_route',
    stages:       FieldValue.arrayUnion(stageRecord),
    updatedAt:    FieldValue.serverTimestamp(),
  });
});

console.log(`   booking.status    → en_route`);
console.log(`   job.currentStage  → en_route`);

// ── Read back ─────────────────────────────────────────────────────────────────
console.log('\n[3/4] Reading back documents...');

const [bookingSnap, jobSnap] = await Promise.all([
  db.collection('bookings').doc(bookingId).get(),
  db.collection('jobs').doc(jobId).get(),
]);

function serialize(obj) {
  if (!obj) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (v && typeof v.toDate === 'function') return [k, v.toDate().toISOString()];
      if (Array.isArray(v)) return [k, v.map(item =>
        typeof item === 'object' && item !== null
          ? serialize(item)
          : item
      )];
      return [k, v];
    })
  );
}

const b = bookingSnap.data();
const j = jobSnap.data();

console.log('\n[4/4] Results:\n');
console.log('── BOOKING DOCUMENT (' + bookingId + ') ──────────────────────');
console.log(JSON.stringify(serialize(b), null, 2));

console.log('\n── JOB DOCUMENT (' + jobId + ') ───────────────────────────');
console.log(JSON.stringify(serialize(j), null, 2));

console.log('\n── SUMMARY ──────────────────────────────────────────────────');
console.log('bookingId:      ', bookingId);
console.log('jobId:          ', b.jobId);
console.log('booking.status: ', b.status);
console.log('currentStage:   ', j.currentStage);
console.log('stages:         ', JSON.stringify(j.stages));
console.log('');
