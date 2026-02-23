'use client';

/**
 * Subscriptions catalog — browse all active subscription plans.
 *
 * Loads plans from Firestore via getActivePlans() (one-time fetch).
 * The customer's active subscriptions are loaded via useSubscriptions
 * to show active status on each card.
 *
 * Enrollment is currently disabled (Stripe not yet wired in MVP).
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { getActivePlans } from '@/services/subscriptionService';
import { PlanCard } from '@/components/subscriptions/PlanCard';
import type { SubscriptionPlan } from '@/types';

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const { subscriptions, loading: subsLoading } = useSubscriptions(user?.uid ?? null);

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActivePlans()
      .then(setPlans)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Build a map from planId → CustomerSubscription for quick lookup
  const activeSubByPlan = Object.fromEntries(
    subscriptions.map((s) => [s.planId, s])
  );

  const isLoading = loading || subsLoading;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-text-primary">Subscription Plans</h1>
        <p className="text-text-secondary text-sm mt-1">
          Save on recurring services with a membership plan
        </p>
      </div>

      {/* Plans list */}
      <div className="px-4 pb-8 space-y-4">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-52 bg-surface-raised rounded-xl animate-pulse" />
            ))}
          </>
        ) : plans.length === 0 ? (
          <div className="bg-surface-raised rounded-xl p-10 text-center border border-surface-border">
            <svg
              className="mx-auto mb-3 text-text-muted"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 4v5" />
              <path d="M15 4v5" />
            </svg>
            <p className="text-text-muted text-sm">No plans available right now.</p>
          </div>
        ) : (
          plans.map((plan) => (
            <PlanCard
              key={plan.planId}
              plan={plan}
              activeSubscription={activeSubByPlan[plan.planId] ?? null}
            />
          ))
        )}
      </div>
    </div>
  );
}
