/**
 * NotificationItem — a single tappable row in the notifications list.
 *
 * Unread items have a teal left-accent dot and slightly elevated background.
 * Tapping calls onTap(notification) so the parent can handle deep-linking
 * and mark-as-read in a single handler.
 *
 * Usage:
 *   notifications.map((n) => (
 *     <NotificationItem key={n.notifId} notification={n} onTap={handleTap} />
 *   ))
 */

import type { Notification, NotificationType } from '@/types';

// ── Icon map (SVG path data keyed by NotificationType) ───────────────────────

const TYPE_ICON: Record<NotificationType, { path: string; color: string }> = {
  booking_confirmed:    { path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-brand' },
  technician_accepted:  { path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-status-optimal' },
  technician_en_route:  { path: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m6 0H3m10 0h6m0 0V9a1 1 0 00-1-1h-3.5M6 16V9', color: 'text-brand' },
  job_started:          { path: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z', color: 'text-brand' },
  job_complete:         { path: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z', color: 'text-status-optimal' },
  payment_captured:     { path: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', color: 'text-status-optimal' },
  booking_cancelled:    { path: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-status-fault' },
  system:               { path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-text-muted' },
  maintenance_reminder: { path: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-status-serviceDue' },
  recall_detected:      { path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', color: 'text-status-fault' },
  chat_message:         { path: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', color: 'text-brand' },
  new_job_offer:        { path: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', color: 'text-brand' },
  subscription_renewal: { path: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', color: 'text-brand' },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onTap: (notification: Notification) => void;
}

export function NotificationItem({ notification, onTap }: NotificationItemProps) {
  const icon = TYPE_ICON[notification.type] ?? TYPE_ICON.system;
  const timeStr = formatTimeAgo(notification.createdAt);

  return (
    <button
      onClick={() => onTap(notification)}
      className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
        notification.read
          ? 'bg-surface-raised hover:bg-surface-mid'
          : 'bg-brand/5 border border-brand/15 hover:bg-brand/10'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 mt-0.5 ${icon.color}`}
        >
          <path d={icon.path} />
        </svg>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-sm font-medium leading-tight ${
                notification.read ? 'text-text-secondary' : 'text-text-primary'
              }`}
            >
              {notification.title}
            </p>
            <span className="text-[10px] text-text-muted shrink-0 mt-0.5">{timeStr}</span>
          </div>
          <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
            {notification.body}
          </p>
        </div>

        {/* Unread dot */}
        {!notification.read && (
          <span className="shrink-0 w-2 h-2 rounded-full bg-brand mt-1.5" />
        )}
      </div>
    </button>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimeAgo(date: Date | { toDate(): Date } | string): string {
  let ms: number;
  if (date instanceof Date) {
    ms = date.getTime();
  } else if (typeof date === 'object' && 'toDate' in date) {
    ms = date.toDate().getTime();
  } else {
    ms = new Date(date).getTime();
  }

  if (isNaN(ms)) return '';

  const diffMs = Date.now() - ms;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
