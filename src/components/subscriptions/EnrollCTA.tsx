/**
 * EnrollCTA — enrollment button for a subscription plan.
 *
 * IMPORTANT — MVP CONSTRAINT:
 *   Stripe subscriptions are not wired yet. The button is rendered
 *   disabled with a tooltip explaining this. The onEnroll callback
 *   will not be called. This is intentional per the Phase 3 spec.
 *
 *   When Stripe is connected (Phase 4), remove the `disabled` prop
 *   and the warning label.
 *
 * Usage:
 *   <EnrollCTA planId={plan.planId} onEnroll={(id) => handleEnroll(id)} />
 */

interface EnrollCTAProps {
  planId: string;
  /** Called with planId when user confirms enrollment. Not called in MVP (disabled). */
  onEnroll: (planId: string) => void;
  /** Override loading state from a parent enrollment flow. */
  loading?: boolean;
}

export function EnrollCTA({ planId, onEnroll, loading = false }: EnrollCTAProps) {
  // MVP: Stripe subscription payments are not yet connected.
  // The button is rendered but disabled per the architecture spec.
  const stripeConnected = false;

  function handleClick() {
    if (!stripeConnected || loading) return;
    onEnroll(planId);
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={!stripeConnected || loading}
        aria-disabled={!stripeConnected || loading}
        className={[
          'w-full py-2.5 rounded-xl text-sm font-semibold transition-colors',
          stripeConnected && !loading
            ? 'bg-brand text-black hover:bg-brand/90 active:scale-[0.98]'
            : 'bg-surface-mid text-text-muted cursor-not-allowed',
        ].join(' ')}
      >
        {loading ? 'Processing…' : 'Enroll Now'}
      </button>

      {!stripeConnected && (
        <p className="text-center text-[10px] text-text-muted">
          Subscription payments coming soon
        </p>
      )}
    </div>
  );
}
