/**
 * Firebase Cloud Messaging — client-side utilities.
 *
 * Only usable in browser context. The companion service worker
 * (public/firebase-messaging-sw.js) handles background/push messages
 * when the app is not in the foreground.
 *
 * Required env var: NEXT_PUBLIC_FCM_VAPID_KEY
 * Generate from: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
 *
 * NEVER import this file in Route Handlers or server-only code.
 * For server-side FCM dispatch, use src/lib/firebase/fcmAdmin.ts.
 */

import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import app from '@/lib/firebase/firebase';

let messagingInstance: Messaging | null = null;

/**
 * Returns a singleton Messaging instance, or null if called server-side.
 * Deferred initialization avoids SSR errors (window/navigator unavailable).
 */
function getMessagingInstance(): Messaging | null {
  if (typeof window === 'undefined') return null;
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
}

/**
 * Requests Notification permission from the browser, then fetches and
 * returns an FCM registration token.
 *
 * Returns null if:
 *  - Running server-side (SSR)
 *  - Notification permission denied by the user
 *  - NEXT_PUBLIC_FCM_VAPID_KEY is not set
 *  - Any other FCM error occurs
 */
export async function requestFCMToken(): Promise<string | null> {
  const messaging = getMessagingInstance();
  if (!messaging) return null;

  const vapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;
  if (!vapidKey) {
    console.warn('[fcm] NEXT_PUBLIC_FCM_VAPID_KEY not configured — skipping FCM registration');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, { vapidKey });
    return token || null;
  } catch (err) {
    console.error('[fcm] requestFCMToken error:', err);
    return null;
  }
}

/**
 * Registers a handler for foreground push messages (app is in the foreground tab).
 * Background messages are handled by the service worker automatically.
 * Returns an unsubscribe function — call it on component unmount.
 */
export function onForegroundMessage(
  handler: (payload: {
    notification?: { title?: string; body?: string };
    data?: Record<string, string>;
  }) => void
): () => void {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};
  // firebase/messaging types the payload broadly — cast to match our usage
  return onMessage(messaging, handler as Parameters<typeof onMessage>[1]);
}
