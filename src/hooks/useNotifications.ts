'use client';

/**
 * useNotifications — real-time unread notification count.
 * Used to drive the notification bell badge in the bottom nav.
 */

import { useState, useEffect } from 'react';
import { listenToUnreadCount } from '@/services/notificationService';

export function useNotifications(uid: string | null): { unreadCount: number } {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!uid) {
      setUnreadCount(0);
      return;
    }
    const unsub = listenToUnreadCount(uid, setUnreadCount);
    return () => unsub();
  }, [uid]);

  return { unreadCount };
}
