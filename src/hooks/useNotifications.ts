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
    let unsub: undefined | (() => void);
    try {
      unsub = listenToUnreadCount(uid, setUnreadCount);
    } catch (e) {
      console.error('[useNotifications] listenToUnreadCount failed', e);
    }
    return () => {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (e) {
        console.warn('[useNotifications] unsub failed', e);
      }
    };
  }, [uid]);

  return { unreadCount };
}
