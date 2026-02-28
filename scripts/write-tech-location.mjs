/**
 * write-tech-location.mjs
 *
 * Writes a GPS fix to the active job's techLocation field.
 * The booking detail page subscribes via useLiveJob → listenToJob (onSnapshot),
 * so this write will push the tech marker to the live map immediately.
 *
 * Usage:
 *   node scripts/write-tech-location.mjs
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

// ── Find active job (en_route) ────────────────────────────────────────────────
console.log('\n[1/3] Finding active en_route job...');

const snap = await db
  .collection('jobs')
  .where('currentStage', '==', 'en_route')
  .get();

if (snap.empty) {
  console.error('No en_route jobs found. Run advance-booking-en-route.mjs first.');
  process.exit(1);
}

// Take the most recently updated
const jobs = snap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .sort((a, b) => {
    const aTime = a.updatedAt?.toDate?.()?.getTime() ?? 0;
    const bTime = b.updatedAt?.toDate?.()?.getTime() ?? 0;
    return bTime - aTime;
  });

const job   = jobs[0];
const jobId = job.id;

console.log(`   jobId:      ${jobId}`);
console.log(`   bookingId:  ${job.bookingId}`);
console.log(`   stage:      ${job.currentStage}`);

// ── Write techLocation ────────────────────────────────────────────────────────
console.log('\n[2/3] Writing techLocation...');

const location = {
  lat:       38.3004,
  lng:       -76.6350,
  heading:   120,
  speed:     12,
  updatedAt: FieldValue.serverTimestamp(),
};

await db.collection('jobs').doc(jobId).update({
  techLocation: location,
  updatedAt:    FieldValue.serverTimestamp(),
});

// ── Read back and confirm ─────────────────────────────────────────────────────
console.log('\n[3/3] Confirming job document...');

const jobSnap = await db.collection('jobs').doc(jobId).get();
const updated = jobSnap.data();

function serialize(obj) {
  if (!obj) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (v && typeof v.toDate === 'function') return [k, v.toDate().toISOString()];
      if (Array.isArray(v)) return [k, v.map(item =>
        typeof item === 'object' && item !== null ? serialize(item) : item
      )];
      if (typeof v === 'object' && v !== null) return [k, serialize(v)];
      return [k, v];
    })
  );
}

console.log('\n── JOB DOCUMENT (' + jobId + ') ───────────────────────────');
console.log(JSON.stringify(serialize(updated), null, 2));

console.log('\n── SUMMARY ──────────────────────────────────────────────────');
console.log('jobId:                 ', jobId);
console.log('currentStage:          ', updated.currentStage);
console.log('techLocation.lat:      ', updated.techLocation?.lat);
console.log('techLocation.lng:      ', updated.techLocation?.lng);
console.log('techLocation.heading:  ', updated.techLocation?.heading);
console.log('techLocation.speed:    ', updated.techLocation?.speed);
console.log('techLocation.updatedAt:', updated.techLocation?.updatedAt?.toDate?.().toISOString() ?? '(pending server ts)');
console.log('');
console.log('onSnapshot subscribers on this job will receive the update');
console.log('immediately — tech marker will appear on the live map.');
console.log('');
