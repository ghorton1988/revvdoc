/**
 * Chat Service — Firestore data access for bookings/{bookingId}/messages subcollection.
 *
 * CRITICAL RULES:
 * 1. Chat is locked until booking.status is 'accepted', 'en_route', or 'in_progress'.
 *    The ChatContainer component enforces this in the UI via ChatState.
 *    The Firestore security rule enforces it server-side via bookingStatus on the message.
 *
 * 2. sendMessage() MUST denormalize customerId, technicianId, and bookingStatus onto
 *    every message. This avoids cross-document get() calls in security rules.
 *    The caller is responsible for passing these from the booking object they hold.
 *
 * 3. Messages are immutable from the client — no update or delete functions are exposed.
 *    System messages (type='system') are written by server-side Route Handlers only.
 *
 * TODO Phase 3 (Wave 3): implement all function bodies.
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { ChatMessage, ChatState, Booking } from '@/types';

/** Derives chat state from a booking's current status. Never throws. */
export function getChatState(booking: Booking): ChatState {
  switch (booking.status) {
    case 'accepted':
    case 'en_route':
    case 'in_progress':
      return 'active';
    case 'complete':
      return 'read_only';
    default:
      return 'locked';
  }
}

/**
 * Loads the most recent messages for a booking, oldest-first.
 * Paginates to the last `limitCount` messages to control read costs.
 */
export async function getMessages(
  bookingId: string,
  limitCount = 50
): Promise<ChatMessage[]> {
  // TODO Phase 3: implement
  const ref = collection(db, 'bookings', bookingId, 'messages');
  const q = query(ref, orderBy('createdAt', 'asc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ messageId: d.id, ...d.data() }) as ChatMessage);
}

/**
 * Subscribes to live message updates for a booking thread.
 * Calls onUpdate with the full ordered message list on every change.
 * Returns an unsubscribe function — call it on component unmount.
 */
export function listenToMessages(
  bookingId: string,
  onUpdate: (messages: ChatMessage[]) => void,
  limitCount = 50
): Unsubscribe {
  // TODO Phase 3: implement
  const ref = collection(db, 'bookings', bookingId, 'messages');
  const q = query(ref, orderBy('createdAt', 'asc'), limit(limitCount));
  return onSnapshot(
    q,
    (snap) => {
      const messages = snap.docs.map(
        (d) => ({ messageId: d.id, ...d.data() }) as ChatMessage
      );
      onUpdate(messages);
    },
    (err) => {
      console.error('[listenToMessages]', err);
      onUpdate([]);
    }
  );
}

/**
 * Sends a user-authored text message.
 *
 * Denormalized fields (customerId, technicianId, bookingStatus) MUST come
 * from the caller's booking object — they are required by security rules to
 * enforce the chat lock without a cross-document get() call.
 *
 * Will be rejected by Firestore if bookingStatus is not in
 * ['accepted', 'en_route', 'in_progress'].
 */
export async function sendMessage(
  bookingId: string,
  senderId: string,
  senderRole: 'customer' | 'technician',
  body: string,
  // Denormalized from the caller's booking for rule efficiency
  denormalized: {
    customerId: string;
    technicianId: string;
    bookingStatus: Booking['status'];
  }
): Promise<void> {
  // TODO Phase 3: implement
  const ref = collection(db, 'bookings', bookingId, 'messages');
  await addDoc(ref, {
    bookingId,
    senderId,
    senderRole,
    body: body.trim(),
    type: 'text',
    readBy: [senderId],
    customerId: denormalized.customerId,
    technicianId: denormalized.technicianId,
    bookingStatus: denormalized.bookingStatus,
    createdAt: serverTimestamp(),
  });
}

/**
 * Marks a message as read by appending the viewer's uid to readBy[].
 * No-op if the uid is already in the array (handled by Firestore arrayUnion).
 */
export async function markMessageRead(
  bookingId: string,
  messageId: string,
  uid: string
): Promise<void> {
  // TODO Phase 3: implement — use arrayUnion
  const { updateDoc, arrayUnion } = await import('firebase/firestore');
  await updateDoc(doc(db, 'bookings', bookingId, 'messages', messageId), {
    readBy: arrayUnion(uid),
  });
}
