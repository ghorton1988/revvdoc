/**
 * Firebase Admin SDK — server-side only.
 * NEVER import this file in components, hooks, or client-side services.
 * Only use in: src/app/api/** Route Handlers and src/middleware.ts.
 *
 * The Admin SDK bypasses Firestore security rules — use it only for
 * operations that require elevated server-side access (webhooks, job
 * completion writes, notification creation).
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      // The private key comes from env with escaped newlines — replace them
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });
}

export const adminApp: App = getAdminApp();

export const adminDb: Firestore = getFirestore(adminApp);
export const adminAuth: Auth = getAuth(adminApp);
