/**
 * AI Session Service — Firestore data access for aiSessions collection.
 *
 * Client-side reads only. All writes (creating sessions, storing messages)
 * happen via the /api/ai/chat Route Handler (Admin SDK).
 *
 * Collection structure:
 *   aiSessions/{sessionId}
 *   aiSessions/{sessionId}/messages/{messageId}
 */

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { AISession, AIMessage } from '@/types';

const SESSIONS = 'aiSessions';

/**
 * Returns the most recent AI session for a user+vehicle pair.
 * Used to resume a previous conversation instead of creating a new one.
 */
export async function getLatestSession(
  userId: string,
  vehicleId: string
): Promise<AISession | null> {
  const q = query(
    collection(db, SESSIONS),
    where('userId',    '==', userId),
    where('vehicleId', '==', vehicleId),
    orderBy('updatedAt', 'desc'),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const d = snap.docs[0];
  return { sessionId: d.id, ...d.data() } as AISession;
}

/**
 * Real-time listener for messages in a session, sorted oldest-first.
 * Calls onUpdate whenever a message is added by the server.
 */
export function listenToMessages(
  sessionId: string,
  onUpdate: (messages: AIMessage[]) => void,
  limitCount = 50
): Unsubscribe {
  const q = query(
    collection(db, SESSIONS, sessionId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map(
      (d) => ({ messageId: d.id, ...d.data() }) as AIMessage
    );
    onUpdate(messages);
  });
}
