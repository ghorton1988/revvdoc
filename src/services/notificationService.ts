/**
 * Notification Service — Firestore data access for notifications collection.
 */

import {
  collection,
  doc,
  updateDoc,
  getDocs,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { Notification, NotificationType } from '@/types';

const NOTIFICATIONS = 'notifications';

function mapNotification(id: string, data: Record<string, unknown>): Notification {
  return {
    notifId: id,
    userId: data.userId as string,
    type: data.type as NotificationType,
    title: data.title as string,
    body: data.body as string,
    read: data.read as boolean,
    relatedBookingId: (data.relatedBookingId as string | null) ?? null,
    relatedJobId: (data.relatedJobId as string | null) ?? null,
    createdAt: (data.createdAt as { toDate(): Date }).toDate(),
  };
}

export function listenToUnreadCount(
  userId: string,
  onUpdate: (count: number) => void
): Unsubscribe {
  const q = query(
    collection(db, NOTIFICATIONS),
    where('userId', '==', userId),
    where('read', '==', false)
  );
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.size),
    (err) => {
      console.error('[listenToUnreadCount]', err);
      onUpdate(0);
    }
  );
}

export async function getNotifications(
  userId: string,
  limitCount = 20
): Promise<Notification[]> {
  const q = query(
    collection(db, NOTIFICATIONS),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapNotification(d.id, d.data() as Record<string, unknown>));
}

export async function markAsRead(notifId: string): Promise<void> {
  await updateDoc(doc(db, NOTIFICATIONS, notifId), { read: true });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, NOTIFICATIONS),
    where('userId', '==', userId),
    where('read', '==', false)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  // Firestore batch limit is 500 — process in chunks
  const CHUNK = 500;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach((d) => {
      batch.update(d.ref, { read: true });
    });
    await batch.commit();
  }
}
