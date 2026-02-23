'use client';

/**
 * AssistantPanel — AI vehicle assistant chat UI.
 *
 * Renders the conversation, urgency badges, recommended services,
 * suggested next action, and an image upload + send form.
 *
 * Uses useAIChat hook for all state management.
 * Sessions are anchored to a single vehicleId (pass the selected vehicle).
 *
 * Usage:
 *   <AssistantPanel vehicleId={vehicleId} />
 */

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAIChat } from '@/hooks/useAIChat';
import type { AIMessage, AIUrgency, AINextAction } from '@/types';

// ── Badge helpers ────────────────────────────────────────────────────────────

const URGENCY_STYLE: Record<AIUrgency, { bg: string; text: string; label: string }> = {
  LOW:  { bg: 'bg-status-optimal/15',    text: 'text-status-optimal',    label: 'Low priority' },
  MED:  { bg: 'bg-status-serviceDue/15', text: 'text-status-serviceDue', label: 'Moderate urgency' },
  HIGH: { bg: 'bg-status-fault/15',      text: 'text-status-fault',      label: 'Urgent' },
};

const NEXT_ACTION_LABEL: Record<AINextAction, string> = {
  BOOK:         'Book a service',
  SAVE_NOTE:    'Note saved',
  VIEW_RECALLS: 'View safety recalls',
  UPLOAD_PHOTO: 'Upload a photo',
};

function UrgencyBadge({ urgency }: { urgency: AIUrgency }) {
  const s = URGENCY_STYLE[urgency];
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: AIMessage }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Bubble */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-brand text-black rounded-tr-sm'
            : 'bg-surface-raised border border-surface-border text-text-primary rounded-tl-sm'
        }`}
      >
        {msg.content}
      </div>

      {/* Assistant metadata — urgency, recommendations, next action */}
      {msg.role === 'assistant' && (
        <div className="w-full max-w-[80%] space-y-2">
          {/* Urgency badge */}
          {msg.urgency && <UrgencyBadge urgency={msg.urgency} />}

          {/* Recommended services */}
          {msg.recommendedServices && msg.recommendedServices.length > 0 && (
            <div className="bg-surface-raised border border-brand/20 rounded-xl p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Suggested services</p>
              {msg.recommendedServices.map((s, i) => (
                <div key={i} className="space-y-0.5">
                  <p className="text-sm font-medium text-text-primary">{s.name}</p>
                  <p className="text-xs text-text-muted">{s.reason}</p>
                  {s.id && (
                    <Link
                      href={`/book?serviceId=${s.id}`}
                      className="text-[11px] text-brand font-medium"
                    >
                      Book →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Suggested next action */}
          {msg.suggestedNextAction && msg.suggestedNextAction !== 'SAVE_NOTE' && (
            <NextActionButton action={msg.suggestedNextAction} />
          )}
        </div>
      )}
    </div>
  );
}

function NextActionButton({ action }: { action: AINextAction }) {
  const label = NEXT_ACTION_LABEL[action];

  if (action === 'BOOK') {
    return (
      <Link
        href="/services"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand border border-brand/30 rounded-lg px-3 py-1.5 hover:bg-brand/10 transition-colors"
      >
        {label} →
      </Link>
    );
  }

  if (action === 'VIEW_RECALLS') {
    return (
      <Link
        href="/vehicles"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-status-fault border border-status-fault/30 rounded-lg px-3 py-1.5 hover:bg-status-fault/10 transition-colors"
      >
        {label} →
      </Link>
    );
  }

  return null;
}

// ── Image picker ────────────────────────────────────────────────────────────

function useImagePicker() {
  const [previews, setPreviews] = useState<string[]>([]);

  function addImages(files: FileList) {
    const newPreviews: string[] = [];
    let remaining = 4 - previews.length;

    Array.from(files).slice(0, remaining).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          newPreviews.push(result);
          if (newPreviews.length === Math.min(remaining, files.length)) {
            setPreviews((prev) => [...prev, ...newPreviews].slice(0, 4));
          }
        }
      };
      reader.readAsDataURL(file);
      remaining--;
    });
  }

  function removeImage(index: number) {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function clear() {
    setPreviews([]);
  }

  return { previews, addImages, removeImage, clear };
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface AssistantPanelProps {
  vehicleId: string;
  vehicleName?: string;
}

export function AssistantPanel({ vehicleId, vehicleName }: AssistantPanelProps) {
  const { messages, loading, sending, error, send, clearError } = useAIChat(vehicleId);
  const { previews, addImages, removeImage, clear: clearImages } = useImagePicker();
  const [inputText, setInputText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    setInputText('');
    clearImages();
    clearError();

    await send(text, previews.length > 0 ? previews : undefined);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-surface-border flex items-center gap-3 shrink-0">
        {/* Brain/sparkle icon */}
        <div className="h-9 w-9 rounded-full bg-brand/15 flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-text-primary">RevvDoc Assistant</p>
          {vehicleName && <p className="text-xs text-text-muted">{vehicleName}</p>}
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className="h-12 w-2/3 bg-surface-raised rounded-2xl animate-pulse" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
            <p className="text-text-primary font-medium">Hey, I&apos;m your vehicle assistant.</p>
            <p className="text-sm text-text-muted">
              Describe a sound, warning light, or concern and I&apos;ll help you understand what&apos;s going on.
            </p>
            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {[
                'My brakes are squealing',
                'Check engine light is on',
                'Car makes noise when turning',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInputText(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full bg-surface-raised border border-surface-border text-text-secondary hover:border-brand/30 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.messageId} msg={msg} />)
        )}

        {/* Sending indicator */}
        {sending && (
          <div className="flex items-start gap-2">
            <div className="flex gap-1 bg-surface-raised border border-surface-border rounded-2xl rounded-tl-sm px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 pb-2">
          <div className="bg-status-fault/10 border border-status-fault/30 rounded-xl px-3 py-2 flex items-center justify-between">
            <p className="text-xs text-status-fault">{error}</p>
            <button onClick={clearError} className="text-status-fault ml-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Image previews */}
      {previews.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
          {previews.map((src, i) => (
            <div key={i} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`preview ${i + 1}`} className="h-16 w-16 rounded-lg object-cover" />
              <button
                onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-status-fault text-white flex items-center justify-center"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSend} className="px-4 pb-4 pt-2 shrink-0 border-t border-surface-border">
        <div className="flex items-end gap-2">
          {/* Image attach */}
          <button
            type="button"
            disabled={previews.length >= 4}
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 h-10 w-10 rounded-xl bg-surface-raised border border-surface-border flex items-center justify-center text-text-muted hover:text-brand hover:border-brand/30 transition-colors disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addImages(e.target.files)}
          />

          {/* Text input */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Describe your vehicle issue…"
            className="flex-1 bg-surface-raised border border-surface-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand/50 resize-none leading-relaxed"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />

          {/* Send */}
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="shrink-0 h-10 w-10 rounded-xl bg-brand text-black flex items-center justify-center disabled:opacity-40 hover:bg-brand/90 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        <p className="text-[10px] text-text-muted mt-1.5 text-center">
          Suggestions are informational — not a professional diagnosis.
        </p>
      </form>
    </div>
  );
}
