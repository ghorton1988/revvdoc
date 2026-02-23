'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from '@/services/notificationService';
import { NotificationItem } from '@/components/ui/NotificationItem';
import type { Notification } from '@/types';

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getNotifications(user.uid);
      setNotifications(data);
    } catch (err) {
      console.error('[notifications] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    fetchNotifications();
  }, [user, authLoading, fetchNotifications]);

  async function handleTap(notification: Notification) {
    // Optimistic mark-as-read
    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.notifId === notification.notifId ? { ...n, read: true } : n
        )
      );
      await markAsRead(notification.notifId).catch(console.error);
    }

    // Deep-link to the related entity
    if (notification.relatedJobId) {
      router.push(`/jobs/${notification.relatedJobId}`);
    } else if (notification.relatedBookingId) {
      router.push(`/bookings/${notification.relatedBookingId}`);
    }
  }

  async function handleMarkAll() {
    if (!user || markingAll) return;
    setMarkingAll(true);
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllAsRead(user.uid);
    } catch (err) {
      console.error('[notifications] markAllAsRead error:', err);
      // Re-fetch to restore true state on error
      await fetchNotifications();
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading || authLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-8 w-44 bg-surface-raised rounded animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-surface-raised rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────

  return (
    <div className="p-4 pb-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-xs text-text-muted mt-0.5">{unreadCount} unread</p>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={markingAll}
            className="text-xs text-brand font-medium disabled:opacity-60"
          >
            {markingAll ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Empty state */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-text-muted/40"
          >
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-sm text-text-muted">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <NotificationItem key={n.notifId} notification={n} onTap={handleTap} />
          ))}
        </div>
      )}
    </div>
  );
}
