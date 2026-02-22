// TODO Phase 3: Payment methods management
// - listPaymentMethods(stripeCustomerId) → show saved cards (last4, brand, expiry)
// - Add card: Stripe Elements SetupIntent flow
// - Remove card: detachPaymentMethod(paymentMethodId)
// - Default card indicator

export default function PaymentMethodsPage() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">Payment Methods</h1>
      <p className="text-text-muted text-sm">Phase 3 — not yet implemented</p>
    </div>
  );
}
