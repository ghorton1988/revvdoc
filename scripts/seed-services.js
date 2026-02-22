/**
 * RevvDoc — Service Catalog Seed Script
 *
 * Seeds the Firestore `services` collection with realistic service data.
 * Run from the project root: node scripts/seed-services.js
 *
 * Safe to re-run: checks for existing docs to avoid duplicates.
 */

'use strict';

// Load .env.local manually (no dotenv dependency required)
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// ── Init Admin SDK ─────────────────────────────────────────────────────────

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });

const db = getFirestore(adminApp);

// ── Service catalog ────────────────────────────────────────────────────────
// All prices in USD cents. Durations in minutes.

const SERVICES = [
  // ── Mechanic ─────────────────────────────────────────────────────────────
  {
    name: 'Oil Change',
    category: 'mechanic',
    description:
      'Full synthetic or conventional oil change with new filter. Includes 20-point inspection and fluid top-off.',
    basePrice: 8900,      // $89
    durationMins: 45,
    isActive: true,
    sortOrder: 10,
  },
  {
    name: 'Brake Pad Replacement',
    category: 'mechanic',
    description:
      'Front or rear brake pad replacement with rotor inspection. Parts and labor included. OEM-quality pads.',
    basePrice: 22900,     // $229
    durationMins: 90,
    isActive: true,
    sortOrder: 20,
  },
  {
    name: 'Battery Replacement',
    category: 'mechanic',
    description:
      'Battery test, removal of old battery, and installation of new one. Warranty on battery included.',
    basePrice: 17900,     // $179
    durationMins: 30,
    isActive: true,
    sortOrder: 30,
  },
  {
    name: 'Tire Rotation & Balance',
    category: 'mechanic',
    description:
      'Rotate all four tires to even out tread wear and balance for a smoother ride.',
    basePrice: 6900,      // $69
    durationMins: 60,
    isActive: true,
    sortOrder: 40,
  },
  {
    name: 'Air Filter Replacement',
    category: 'mechanic',
    description:
      'Engine and cabin air filter inspection and replacement. Improves fuel efficiency and air quality.',
    basePrice: 4900,      // $49
    durationMins: 20,
    isActive: true,
    sortOrder: 50,
  },

  // ── Detailing ─────────────────────────────────────────────────────────────
  {
    name: 'Full Detail',
    category: 'detailing',
    description:
      'Complete interior and exterior detail. Includes wash, clay bar, polish, wax, vacuum, shampoo, and leather conditioning.',
    basePrice: 29900,     // $299
    durationMins: 240,
    isActive: true,
    sortOrder: 10,
  },
  {
    name: 'Exterior Wash & Wax',
    category: 'detailing',
    description:
      'Hand wash, clay bar treatment, one-step polish, and carnauba wax application. UV protection included.',
    basePrice: 14900,     // $149
    durationMins: 120,
    isActive: true,
    sortOrder: 20,
  },
  {
    name: 'Interior Detail',
    category: 'detailing',
    description:
      'Deep vacuum, steam clean, shampoo carpets and seats, clean dash and console, deodorize.',
    basePrice: 14900,     // $149
    durationMins: 120,
    isActive: true,
    sortOrder: 30,
  },
  {
    name: 'Ceramic Coating',
    category: 'detailing',
    description:
      'Professional-grade ceramic coating application. 2-year protection, hydrophobic finish, UV and scratch resistance.',
    basePrice: 79900,     // $799
    durationMins: 360,
    isActive: true,
    sortOrder: 40,
  },

  // ── Diagnostic ────────────────────────────────────────────────────────────
  {
    name: 'Check Engine Light Diagnostic',
    category: 'diagnostic',
    description:
      'OBD-II code scan, root cause analysis, and written report with repair recommendations.',
    basePrice: 9900,      // $99
    durationMins: 45,
    isActive: true,
    sortOrder: 10,
  },
  {
    name: 'Pre-Purchase Inspection',
    category: 'diagnostic',
    description:
      '150-point inspection before buying a used vehicle. Covers engine, transmission, brakes, suspension, electrical, and body.',
    basePrice: 19900,     // $199
    durationMins: 90,
    isActive: true,
    sortOrder: 20,
  },
  {
    name: 'AC System Diagnostic',
    category: 'diagnostic',
    description:
      'Diagnose AC performance issues: refrigerant check, compressor test, leak detection.',
    basePrice: 7900,      // $79
    durationMins: 30,
    isActive: true,
    sortOrder: 30,
  },
];

// ── Seed ───────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🔧 RevvDoc — Seeding service catalog...\n');

  const collection = db.collection('services');
  let created = 0;
  let skipped = 0;

  for (const service of SERVICES) {
    // Check for existing doc with the same name to avoid duplicates
    const existing = await collection
      .where('name', '==', service.name)
      .limit(1)
      .get();

    if (!existing.empty) {
      console.log(`  ⏩ Skipped (exists): ${service.name}`);
      skipped++;
      continue;
    }

    await collection.add({
      ...service,
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log(`  ✅ Created: ${service.name} (${service.category}, $${(service.basePrice / 100).toFixed(0)})`);
    created++;
  }

  console.log(`\n✅ Done — ${created} created, ${skipped} skipped.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
