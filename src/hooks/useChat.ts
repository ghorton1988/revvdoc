'use client';

/**
 * useChat — manages the full chat lifecycle for a booking.
 *
 * Derives ChatState from booking.status (locked / active / read_only).
 * Subscribes to live messages via Firestore onSnapshot.
 * Wraps sendMessage() with the caller's auth context and a sending flag.
 *
 * Usage:
 *   const { messages, chatState, send, sending } = useChat(booking);
 *   // chatState: 'locked' | 'active' | 'read_only'
 *   // send(body) — only callable when chatState === 'active'
 */

import { useState, useEffect, useCallback } from 'react';
import { getChatState, listenToMessages, sendMessage } from '@/services/chatService';
import type { ChatMessage, ChatState, Booking } from '@/types';
import { useAuth } from './useAuth';

export interface ChatHookState {
  messages: ChatMessage[];
  chatState: ChatState;
  send: (body: string) => Promise<void>;
  sending: boolean;
}

export function useChat(booking: Booking | null): ChatHookState {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatState, setChatState] = useState<ChatState>('locked');
  const [sending, setSending] = useState(false);

  // Recompute chat state whenever booking.status changes
  useEffect(() => {
    if (!booking) return;
    setChatState(getChatState(booking));
  }, [booking?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to live messages whenever bookingId is known
  useEffect(() => {
    if (!booking?.bookingId) return;
    const unsub = listenToMessages(booking.bookingId, setMessages);
    return () => unsub();
  }, [booking?.bookingId]);

  const send = useCallback(
    async (body: string) => {
      if (!booking || !user || chatState !== 'active') return;
      const trimmed = body.trim();
      if (!trimmed) return;

      setSending(true);
      try {
        await sendMessage(
          booking.bookingId,
          user.uid,
          user.role === 'technician' ? 'technician' : 'customer',
          trimmed,
          {
            customerId: booking.customerId,
            // technicianId is guaranteed non-null when chatState is 'active'
            technicianId: booking.technicianId!,
            bookingStatus: booking.status,
          }
        );
      } finally {
        setSending(false);
      }
    },
    [booking, user, chatState]
  );

  return { messages, chatState, send, sending };
}
