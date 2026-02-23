/**
 * Firebase Cloud Messaging Service Worker
 *
 * Handles push notifications received when the RevvDoc app is not in the
 * foreground (tab closed, minimised, or on another tab).
 *
 * SETUP: Replace the placeholder config values with your real Firebase project
 * config. These are public keys — it is safe to commit them.
 * Get them from: Firebase Console → Project Settings → General → Your apps
 *
 * This file is served from /firebase-messaging-sw.js by Next.js (placed in /public/).
 * Firebase Messaging automatically uses this path for service worker registration.
 */

/* global firebase */

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// TODO: Replace these placeholder values with your real Firebase project config.
// Copy from: Firebase Console → Project Settings → General → SDK config snippet.
firebase.initializeApp({
  apiKey:            'REPLACE_WITH_NEXT_PUBLIC_FIREBASE_API_KEY',
  authDomain:        'REPLACE_WITH_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId:         'REPLACE_WITH_NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket:     'REPLACE_WITH_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'REPLACE_WITH_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId:             'REPLACE_WITH_NEXT_PUBLIC_FIREBASE_APP_ID',
});

const messaging = firebase.messaging();

/**
 * Background message handler — called when a push arrives while the app
 * is not in the foreground. Displays a system notification.
 *
 * Foreground messages are handled in src/lib/firebase/fcm.ts → onForegroundMessage().
 */
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'RevvDoc';
  const body  = payload.notification?.body  ?? '';
  const link  = payload.data?.link ?? '/';

  self.registration.showNotification(title, {
    body,
    icon:  '/revvdoc-gauge.png',
    badge: '/revvdoc-gauge.png',
    data:  { link },
  });
});

/**
 * Notification click handler — opens the linked page when the user taps
 * the system notification. Focuses an existing tab if one is open.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = event.notification.data?.link ?? '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus an existing tab if available
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(link);
      }
    })
  );
});
