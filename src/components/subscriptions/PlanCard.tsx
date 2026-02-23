/**
 * PlanCard — displays a single SubscriptionPlan from the catalog.
 *
 * Shows plan name, tagline, monthly price, period badge, and
 * a summary of included entitlements. The EnrollCTA is rendered
 * inside if onEnroll is provided; otherwise the card is read-only.
 *
 * Usage:
 *   <PlanCard plan={plan} activeSubscription={customerSub ?? null} />
 */

import type { SubscriptionPlan, CustomerSubscription, ServiceCategory } from '@/types';
import { EnrollCTA } from './EnrollCTA';

// ── Category display helpers ──────────────────────────────────────────────────

const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  mechanic:    'Mechanic',
  detailing:   'Detailing',
  diagnostic:  'Diagnostic',
};

const PERIOD_LABEL: Record<string, string> = {
  monthly:   '/mo',
  quarterly: '/qtr',
  annual:    '/yr',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: SubscriptionPlan;
  /**
   * Pass the customer's existing subscription for this plan if one exists.
   * Used to show active status instead of the enroll CTA.
   */
  activeSubscription?: CustomerSubscription | null;
  /**
   * Called when the user taps "Enroll" — receives the planId.
   * If omitted, the CTA is not rendered (catalog-only view).
   */
  onEnroll?: (planId: string) => void;
}

export function PlanCard({ plan, activeSubscription, onEnroll }: PlanCardProps) {
  const priceDisplay = (plan.priceMonthly / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const periodSuffix = PERIOD_LABEL[plan.period] ?? `/${plan.period}`;
  const isActive = activeSubscription?.status === 'active';

  return (
    <div className="bg-surface-raised border border-surface-border rounded-xl overflow-hidden">
      {/* Header bar */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-text-primary leading-tight">{plan.name}</h3>
            <p className="text-xs text-text-muted mt-0.5 leading-snug">{plan.tagline}</p>
          </div>

          <div className="shrink-0 text-right">
            <span className="text-xl font-bold text-brand leading-none">{priceDisplay}</span>
            <span className="text-xs text-text-muted">{periodSuffix}</span>
          </div>
        </div>

        {/* Period badge */}
        <div className="mt-2">
          <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand/10 text-brand">
            {plan.period}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-surface-border" />

      {/* Entitlements */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
          Included per period
        </p>
        <ul className="space-y-1.5">
          {plan.entitlements.map((e, i) => (
            <li key={i} className="flex items-center gap-2">
              {/* Checkmark icon */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-status-optimal shrink-0"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-sm text-text-secondary">
                {e.usagesPerPeriod}× {CATEGORY_LABEL[e.serviceCategory] ?? e.serviceCategory}
                {e.serviceId === null ? ' (any service)' : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Enroll CTA or active badge */}
      <div className="px-4 pb-4">
        {isActive ? (
          <div className="flex items-center gap-2 py-2">
            <span className="h-2 w-2 rounded-full bg-status-optimal shrink-0" />
            <span className="text-sm text-status-optimal font-medium">Active subscription</span>
          </div>
        ) : onEnroll ? (
          <EnrollCTA planId={plan.planId} onEnroll={onEnroll} />
        ) : null}
      </div>
    </div>
  );
}
