'use client';

/**
 * useSubscriptions — fetches the current customer's active subscriptions.
 *
 * One-time load (not real-time) — subscriptions change rarely and writes go
 * through server-side Route Handlers, so polling is not necessary.
 *
 * Usage:
 *   const { subscriptions, loading } = useSubscriptions(user?.uid ?? null);
 */

import { useState, useEffect } from 'react';
import { getActiveSubscriptions } from '@/services/subscriptionService';
import type { CustomerSubscription } from '@/types';

export interface SubscriptionsState {
  subscriptions: CustomerSubscription[];
  loading: boolean;
}

export function useSubscriptions(customerId: string | null): SubscriptionsState {
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) {
      setSubscriptions([]);
      setLoading(false);
      return;
    }

    getActiveSubscriptions(customerId)
      .then(setSubscriptions)
      .catch((err) => console.error('[useSubscriptions]', err))
      .finally(() => setLoading(false));
  }, [customerId]);

  return { subscriptions, loading };
}
