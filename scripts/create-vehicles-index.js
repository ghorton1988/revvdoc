/**
 * Creates the vehicles composite index: ownerId ASC + createdAt DESC
 * Run: node scripts/create-vehicles-index.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const { GoogleAuth } = require('google-auth-library');
const https = require('https');

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID;

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Get access token with cloud-platform scope
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/datastore',
    ],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();

  // First: check what IAM roles we have on this project
  console.log('🔍 Checking IAM permissions for service account...');
  const iamBody = JSON.stringify({
    permissions: [
      'datastore.indexes.create',
      'datastore.indexes.list',
      'datastore.databases.get',
    ],
  });
  const iamRes = await request(
    {
      hostname: 'cloudresourcemanager.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}:testIamPermissions`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(iamBody),
      },
    },
    iamBody
  );
  console.log('   Permissions granted:', JSON.stringify(iamRes.body?.permissions ?? []));

  // Try to create the vehicles index
  console.log('\n📇 Creating vehicles composite index (ownerId ASC, createdAt DESC)...');
  const indexBody = JSON.stringify({
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'ownerId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  });

  const res = await request(
    {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/vehicles/indexes`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(indexBody),
      },
    },
    indexBody
  );

  if (res.status === 200) {
    console.log('✅ Index created! Building in background (1-5 min).');
    console.log('   Name:', res.body.name);
  } else if (res.status === 409) {
    console.log('✅ Index already exists — nothing to do.');
  } else {
    const errMsg = res.body?.error?.message ?? JSON.stringify(res.body);
    console.error(`❌ Failed (HTTP ${res.status}): ${errMsg}`);
    console.log('\n📎 Create it manually in Firebase Console:');
    console.log(`   https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes`);
    console.log('\n   Collection: vehicles');
    console.log('   Fields: ownerId (Ascending), createdAt (Descending)');
    console.log('   Query scope: Collection');
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
