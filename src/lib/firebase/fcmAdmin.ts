/**
 * FCM Admin — server-side FCM notification dispatch via Firebase Admin SDK.
 *
 * Used by Route Handlers to send push notifications to user devices.
 * Automatically cleans up stale/unregistered tokens from Firestore.
 *
 * NEVER import this file in components, hooks, or client-side services.
 * Only use in: src/app/api/** Route Handlers.
 */

import { getMessaging } from 'firebase-admin/messaging';
import { adminApp, adminDb } from './firebaseAdmin';

const adminMessaging = getMessaging(adminApp);

export interface FCMPayload {
  title: string;
  body: string;
  /** Relative or absolute URL to open when the notification is tapped. */
  link?: string;
  /** Arbitrary key/value data forwarded to the service worker and app. */
  data?: Record<string, string>;
}

/**
 * Sends an FCM push notification to all registered devices for a user.
 *
 * Reads FCM tokens from users/{uid}/fcmTokens (subcollection).
 * Sends a web-push multicast and cleans up any tokens Firebase marks as
 * UNREGISTERED (device app uninstalled, token expired, etc.).
 *
 * @returns The number of messages successfully delivered.
 */
export async function sendFCMToUser(uid: string, payload: FCMPayload): Promise<number> {
  const tokensSnap = await adminDb
    .collection('users')
    .doc(uid)
    .collection('fcmTokens')
    .get();

  if (tokensSnap.empty) return 0;

  const tokens = tokensSnap.docs
    .map((d) => d.data().token as string)
    .filter(Boolean);

  if (tokens.length === 0) return 0;

  const { title, body, link, data } = payload;

  const response = await adminMessaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    // Merge custom data + link for client-side routing
    data: { ...(data ?? {}), ...(link ? { link } : {}) },
    webpush: {
      notification: {
        title,
        body,
        icon: '/revvdoc-gauge.png',
        badge: '/revvdoc-gauge.png',
      },
      fcmOptions: { link: link ?? '/' },
    },
  });

  // Clean up tokens that FCM no longer recognises (device uninstalled, token rotated)
  const staleIndexes: number[] = [];
  response.responses.forEach((r, idx) => {
    if (
      !r.success &&
      r.error?.code === 'messaging/registration-token-not-registered'
    ) {
      staleIndexes.push(idx);
    }
  });

  if (staleIndexes.length > 0) {
    const batch = adminDb.batch();
    staleIndexes.forEach((idx) => batch.delete(tokensSnap.docs[idx].ref));
    await batch.commit().catch((err) =>
      console.error('[fcmAdmin] stale token cleanup error:', err)
    );
  }

  return response.successCount;
}
