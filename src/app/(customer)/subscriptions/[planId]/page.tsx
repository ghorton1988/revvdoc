'use client';

/**
 * Subscription plan detail page.
 *
 * Shows full plan details, the customer's current subscription status
 * for this plan, and a vehicle-scoped enroll CTA.
 *
 * Enrollment posts to /api/subscriptions/enroll with the selected vehicleId.
 * In MVP the EnrollCTA renders disabled — Stripe not yet wired.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { getPlanById } from '@/services/subscriptionService';
import { getVehiclesByOwner } from '@/services/vehicleService';
import { PlanCard } from '@/components/subscriptions/PlanCard';
import type { SubscriptionPlan, Vehicle } from '@/types';

export default function PlanDetailPage() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { subscriptions } = useSubscriptions(user?.uid ?? null);

  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState('');

  // Load plan + vehicles in parallel
  useEffect(() => {
    if (!user) return;

    Promise.all([
      getPlanById(planId),
      getVehiclesByOwner(user.uid),
    ])
      .then(([p, v]) => {
        setPlan(p);
        setVehicles(v);
        if (v.length > 0) setSelectedVehicleId(v[0].vehicleId);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, user?.uid]);

  const activeSubscription = subscriptions.find(
    (s) => s.planId === planId && s.status === 'active'
  ) ?? null;

  async function handleEnroll(enrollPlanId: string) {
    if (!user || !selectedVehicleId || enrolling) return;
    setEnrolling(true);
    setEnrollError('');

    try {
      const { getAuth } = await import('firebase/auth');
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      const res = await fetch('/api/subscriptions/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ planId: enrollPlanId, vehicleId: selectedVehicleId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Enrollment failed');
      }

      router.push('/subscriptions');
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 w-40 bg-surface-raised rounded animate-pulse" />
        <div className="h-52 bg-surface-raised rounded-xl animate-pulse" />
        <div className="h-12 bg-surface-raised rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-4 text-center py-16 space-y-3">
        <p className="text-text-muted text-sm">Plan not found.</p>
        <button
          onClick={() => router.back()}
          className="text-brand text-sm"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 pb-8 space-y-5">
      {/* Back header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-text-secondary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-text-primary">{plan.name}</h1>
      </div>

      {/* Plan card */}
      <PlanCard
        plan={plan}
        activeSubscription={activeSubscription}
        onEnroll={handleEnroll}
      />

      {/* Vehicle selector — only shown when not already active */}
      {!activeSubscription && vehicles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Apply to vehicle
          </p>
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className="w-full bg-surface-raised border border-surface-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand/50"
          >
            {vehicles.map((v) => (
              <option key={v.vehicleId} value={v.vehicleId}>
                {v.year} {v.make} {v.model}{v.nickname ? ` — ${v.nickname}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {!activeSubscription && vehicles.length === 0 && !loading && (
        <p className="text-sm text-text-muted text-center py-2">
          Add a vehicle first before enrolling in a plan.
        </p>
      )}

      {enrollError && (
        <p className="text-sm text-status-fault text-center">{enrollError}</p>
      )}

      {enrolling && (
        <p className="text-sm text-text-muted text-center animate-pulse">Processing enrollment…</p>
      )}
    </div>
  );
}
