'use client';

/**
 * BookingChatPanel — in-booking service chat UI.
 *
 * Renders three states driven by ChatState:
 *  'locked'    → placeholder message (chat unavailable until tech accepts)
 *  'active'    → message list + text input (full two-way chat)
 *  'read_only' → message list + closed notice (post-completion archive)
 *
 * Wire-up: pass props from useChat() and the current user's uid.
 *
 *   const { messages, chatState, send, sending } = useChat(booking);
 *   <BookingChatPanel
 *     messages={messages}
 *     chatState={chatState}
 *     currentUserId={user.uid}
 *     onSend={send}
 *     sending={sending}
 *   />
 */

import { useRef, useEffect, useState, type KeyboardEvent } from 'react';
import type { ChatMessage, ChatState } from '@/types';

interface BookingChatPanelProps {
  messages: ChatMessage[];
  chatState: ChatState;
  currentUserId: string;
  onSend: (body: string) => Promise<void>;
  sending: boolean;
}

export function BookingChatPanel({
  messages,
  chatState,
  currentUserId,
  onSend,
  sending,
}: BookingChatPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to latest message whenever the list changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend() {
    const body = input.trim();
    if (!body || sending || chatState !== 'active') return;
    setInput('');
    await onSend(body);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Locked state ──────────────────────────────────────────────────────────

  if (chatState === 'locked') {
    return (
      <div className="border-t border-surface-border mt-4 pt-4">
        <div className="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-xl">
          {/* Lock icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-text-muted shrink-0"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="text-sm text-text-muted">
            Chat opens once a technician accepts your booking.
          </p>
        </div>
      </div>
    );
  }

  // ── Active / Read-only states ─────────────────────────────────────────────

  return (
    <div className="border-t border-surface-border mt-4 pt-4">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
        Service Chat
        {chatState === 'read_only' && (
          <span className="ml-2 font-normal normal-case text-[10px] bg-surface-raised px-1.5 py-0.5 rounded">
            read-only
          </span>
        )}
      </p>

      {/* Message list */}
      <div className="space-y-2 max-h-72 overflow-y-auto scroll-smooth pb-2">
        {messages.length === 0 && chatState === 'active' && (
          <p className="text-sm text-text-muted text-center py-6">
            No messages yet — say hello!
          </p>
        )}

        {messages.map((msg) => {
          // System messages (automated status changes) appear centred
          if (msg.type === 'system') {
            return (
              <div key={msg.messageId} className="flex justify-center">
                <span className="text-xs text-text-muted bg-surface-raised px-3 py-1 rounded-full">
                  {msg.body}
                </span>
              </div>
            );
          }

          const isMe = msg.senderId === currentUserId;

          return (
            <div
              key={msg.messageId}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  isMe
                    ? 'bg-brand/20 text-text-primary rounded-br-sm'
                    : 'bg-surface-raised text-text-primary rounded-bl-sm'
                }`}
              >
                {msg.body}
              </div>
            </div>
          );
        })}

        {/* Invisible anchor for auto-scroll */}
        <div ref={bottomRef} />
      </div>

      {/* Post-completion notice */}
      {chatState === 'read_only' && (
        <p className="text-xs text-text-muted text-center mt-2 py-2 bg-surface-raised rounded-xl">
          Service complete — chat is now archived.
        </p>
      )}

      {/* Input — only when chat is active */}
      {chatState === 'active' && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            disabled={sending}
            className="flex-1 bg-surface-raised border border-surface-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand/50 transition-colors disabled:opacity-60"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            aria-label="Send message"
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-brand/20 text-brand hover:bg-brand/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {/* Send / paper-plane icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
