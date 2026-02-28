/**
 * patch-booking-address-coords.mjs
 *
 * Patches address.lat / address.lng on the active en_route booking.
 * Uses Firestore dot-notation field paths so the rest of the address
 * object (street, city, state, zip) is untouched.
 *
 * Usage:
 *   node scripts/patch-booking-address-coords.mjs
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

// ── Find the active en_route booking ─────────────────────────────────────────
console.log('\n[1/3] Finding active en_route booking...');

const snap = await db
  .collection('bookings')
  .where('status', '==', 'en_route')
  .get();

if (snap.empty) {
  console.error('No en_route bookings found.');
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

console.log(`   bookingId:  ${bookingId}`);
console.log(`   address:    ${booking.address?.street}, ${booking.address?.city}`);
console.log(`   current lat/lng: ${booking.address?.lat}, ${booking.address?.lng}`);

// ── Patch address coords using dot-notation (preserves other fields) ──────────
console.log('\n[2/3] Patching address.lat / address.lng...');

await db.collection('bookings').doc(bookingId).update({
  'address.lat': 38.2918,
  'address.lng': -76.6355,
  updatedAt:     FieldValue.serverTimestamp(),
});

// ── Read back and confirm ─────────────────────────────────────────────────────
console.log('\n[3/3] Confirming booking document...');

const bookingSnap = await db.collection('bookings').doc(bookingId).get();
const updated     = bookingSnap.data();

function serialize(obj) {
  if (!obj) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (v && typeof v.toDate === 'function') return [k, v.toDate().toISOString()];
      if (Array.isArray(v)) return [k, v.map(i =>
        typeof i === 'object' && i !== null ? serialize(i) : i
      )];
      if (typeof v === 'object' && v !== null) return [k, serialize(v)];
      return [k, v];
    })
  );
}

console.log('\n── BOOKING DOCUMENT (' + bookingId + ') ──────────────────────');
console.log(JSON.stringify(serialize(updated), null, 2));

const addr = updated.address;
console.log('\n── SUMMARY ──────────────────────────────────────────────────');
console.log('bookingId:   ', bookingId);
console.log('jobId:       ', updated.jobId);
console.log('status:      ', updated.status);
console.log('address:     ', `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`);
console.log('address.lat: ', addr.lat);
console.log('address.lng: ', addr.lng);
console.log('');
console.log('listenToBooking onSnapshot will fire with the updated address.');
console.log('BookingLiveMap will pass destLat=38.2918 / destLng=-76.6355 to');
console.log('DirectionsService → polyline drawn, destination pin placed, ETA shown.');
console.log('');
