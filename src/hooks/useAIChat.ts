'use client';

/**
 * useAIChat — manages AI assistant session state for a given vehicle.
 *
 * Handles:
 *  - Session creation / resumption (latest session for user + vehicle)
 *  - Real-time message subscription (onSnapshot via aiSessionService)
 *  - Sending messages (POST /api/ai/chat)
 *  - Loading + sending states
 *
 * Usage:
 *   const { messages, send, sending, sessionId } = useAIChat(user.uid, vehicleId);
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getLatestSession, listenToMessages } from '@/services/aiSessionService';
import type { AIMessage, AIAssistantResponse } from '@/types';

export interface AIChatState {
  messages: AIMessage[];
  sessionId: string | null;
  loading: boolean;    // initial session/messages load
  sending: boolean;    // waiting for AI response
  error: string | null;
  send: (message: string, imageDataUrls?: string[]) => Promise<AIAssistantResponse | null>;
  clearError: () => void;
}

export function useAIChat(vehicleId: string | null): AIChatState {
  const { user } = useAuth();

  const [messages,  setMessages]  = useState<AIMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Load or create session, then subscribe to messages
  useEffect(() => {
    if (!user?.uid || !vehicleId) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        const session = await getLatestSession(user.uid, vehicleId);
        const sid = session?.sessionId ?? null;
        setSessionId(sid);

        if (sid) {
          unsubscribe = listenToMessages(sid, setMessages);
        }
      } catch (err) {
        console.error('[useAIChat] init error:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => { unsubscribe?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, vehicleId]);

  const send = useCallback(async (
    message: string,
    imageDataUrls?: string[]
  ): Promise<AIAssistantResponse | null> => {
    if (!user?.uid || !vehicleId || sending) return null;

    setSending(true);
    setError(null);

    try {
      const { getAuth } = await import('firebase/auth');
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId:        user.uid,
          vehicleId,
          message,
          sessionId:     sessionId ?? undefined,
          imageDataUrls: imageDataUrls ?? [],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? 'AI assistant unavailable');
      }

      const data = await res.json();

      // If this was a new session, start listening to its messages
      if (!sessionId && data.sessionId) {
        setSessionId(data.sessionId);
        listenToMessages(data.sessionId, setMessages);
        // Note: this listener is not cleaned up on unmount; the page re-mount
        // re-subscribes via the useEffect above. Add cleanup if session reuse grows.
        return data;
      }

      return {
        replyText:           data.replyText,
        urgency:             data.urgency,
        recommendedServices: data.recommendedServices,
        suggestedNextAction: data.suggestedNextAction,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      return null;
    } finally {
      setSending(false);
    }
  }, [user?.uid, vehicleId, sessionId, sending]);

  return {
    messages,
    sessionId,
    loading,
    sending,
    error,
    send,
    clearError: () => setError(null),
  };
}
