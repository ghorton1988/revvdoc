'use client';

/**
 * useFCMToken — registers an FCM push-notification token for the current user.
 *
 * On first mount (once uid is known), requests Notification permission, fetches
 * a token, and writes it to users/{uid}/fcmTokens/{docId} in Firestore.
 *
 * The hook is intentionally fire-and-forget: if permission is denied or the
 * VAPID key is missing, it silently no-ops. The app works fine without push.
 *
 * Usage: call once inside the customer/technician root layout, passing the
 * currently signed-in user's uid.
 *
 *   useFCMToken(user?.uid ?? null);
 */

import { useEffect } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { requestFCMToken } from '@/lib/firebase/fcm';

export function useFCMToken(uid: string | null): void {
  useEffect(() => {
    if (!uid) return;

    (async () => {
      try {
        const token = await requestFCMToken();
        if (!token) return;

        // Write the token as a new document in the fcmTokens subcollection.
        // Duplicate tokens are harmless at this scale — cleanup is done server-side
        // when Firebase marks them as UNREGISTERED.
        await addDoc(collection(db, 'users', uid, 'fcmTokens'), {
          token,
          device: 'web',
          // Truncate user agent to avoid Firestore field size issues
          userAgent: navigator.userAgent.slice(0, 200),
          createdAt: serverTimestamp(),
          lastSeen: serverTimestamp(),
        });
      } catch (err) {
        console.error('[useFCMToken]', err);
      }
    })();
  }, [uid]);
}
