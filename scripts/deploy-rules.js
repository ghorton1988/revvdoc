/**
 * RevvDoc — Firestore Rules & Indexes Deploy Script
 *
 * Deploys Firestore security rules and indexes via the Firebase REST APIs,
 * without requiring the Firebase CLI.
 *
 * Run from the project root: node scripts/deploy-rules.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Load .env.local ──────────────────────────────────────────────────────────

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
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

// ── Admin SDK for token ──────────────────────────────────────────────────────

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

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

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID;

// ── Helpers ──────────────────────────────────────────────────────────────────

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken() {
  // Use the service account to get a Google OAuth2 access token
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
}

// ── Deploy Rules ─────────────────────────────────────────────────────────────

async function deployRules(token) {
  console.log('\n📋 Deploying Firestore security rules...');
  const rulesSource = fs.readFileSync(
    path.join(__dirname, '..', 'firestore.rules'),
    'utf8'
  );

  // Step 1: Create a new ruleset
  const rulesetBody = JSON.stringify({
    source: {
      files: [{ content: rulesSource, name: 'firestore.rules' }],
    },
  });

  const rulesetRes = await httpsRequest(
    {
      hostname: 'firebaserules.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/rulesets`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(rulesetBody),
      },
    },
    rulesetBody
  );

  if (rulesetRes.status !== 200) {
    throw new Error(`Failed to create ruleset: ${JSON.stringify(rulesetRes.body)}`);
  }

  const rulesetName = rulesetRes.body.name;
  console.log(`  ✅ Ruleset created: ${rulesetName}`);

  // Step 2: Release the ruleset to the default database
  const releaseBody = JSON.stringify({
    release: {
      name: `projects/${PROJECT_ID}/releases/cloud.firestore`,
      rulesetName,
    },
  });

  const releaseRes = await httpsRequest(
    {
      hostname: 'firebaserules.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/releases/cloud.firestore`,
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(releaseBody),
      },
    },
    releaseBody
  );

  if (releaseRes.status !== 200) {
    // If PATCH fails (release doesn't exist yet), try POST create
    const createBody = JSON.stringify({
      release: {
        name: `projects/${PROJECT_ID}/releases/cloud.firestore`,
        rulesetName,
      },
    });
    const createRes = await httpsRequest(
      {
        hostname: 'firebaserules.googleapis.com',
        path: `/v1/projects/${PROJECT_ID}/releases`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(createBody),
        },
      },
      createBody
    );
    if (createRes.status !== 200) {
      throw new Error(`Failed to release rules: ${JSON.stringify(createRes.body)}`);
    }
  }

  console.log('  ✅ Rules released to cloud.firestore');
}

// ── Deploy Indexes ────────────────────────────────────────────────────────────

async function deployIndexes(token) {
  console.log('\n📇 Deploying Firestore indexes...');
  const indexConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'firestore.indexes.json'), 'utf8')
  );

  let created = 0;
  let skipped = 0;

  for (const index of indexConfig.indexes) {
    // Build the API request body
    const body = JSON.stringify({
      queryScope: index.queryScope,
      fields: index.fields.map((f) => ({
        fieldPath: f.fieldPath,
        ...(f.order ? { order: f.order } : {}),
        ...(f.arrayConfig ? { arrayConfig: f.arrayConfig } : {}),
      })),
    });

    const res = await httpsRequest(
      {
        hostname: 'firestore.googleapis.com',
        path: `/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/${index.collectionGroup}/indexes`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      body
    );

    const fieldDesc = index.fields.map((f) => `${f.fieldPath} ${f.order ?? ''}`).join(', ');
    if (res.status === 409 || (res.body && res.body.error && res.body.error.code === 409)) {
      console.log(`  ⏩ Exists: ${index.collectionGroup} [${fieldDesc}]`);
      skipped++;
    } else if (res.status === 200 || res.status === 200) {
      console.log(`  ✅ Created: ${index.collectionGroup} [${fieldDesc}]`);
      created++;
    } else {
      console.warn(`  ⚠️  ${index.collectionGroup} [${fieldDesc}]: ${res.status} — ${JSON.stringify(res.body?.error?.message ?? res.body)}`);
      skipped++;
    }
  }

  console.log(`\n  ✅ Indexes: ${created} created, ${skipped} skipped/existing`);
  console.log('  ℹ️  New indexes build in the background (1-5 minutes)');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 RevvDoc — Deploying Firestore configuration...');
  console.log(`   Project: ${PROJECT_ID}\n`);

  let token;
  try {
    token = await getAccessToken();
  } catch (err) {
    console.error('❌ Failed to get access token:', err.message);
    console.error('   Make sure FIREBASE_ADMIN_PRIVATE_KEY is set correctly in .env.local');
    process.exit(1);
  }

  await deployRules(token);
  await deployIndexes(token);

  console.log('\n✅ Deployment complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Deploy failed:', err);
  process.exit(1);
});
