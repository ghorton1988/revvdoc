/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook receiver. Handles payment failure and cancellation events.
 * Successful captures are handled directly in /api/stripe/capture-payment.
 *
 * CRITICAL:
 * - runtime = 'nodejs' — edge runtime lacks Buffer (needed for webhook verification)
 * - Read raw body via request.text() — do NOT parse as JSON first
 * - Handler must be idempotent — Stripe may retry deliveries
 */

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import stripe from '@/lib/stripe/stripe';
import type Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // 1. Read raw body for signature verification
  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not set');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  // 2. Verify signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Signature verification failed';
    console.error('[webhook] constructEvent error:', message);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  // 3. Handle events idempotently
  try {
    switch (event.type) {
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(pi);
        break;
      }
      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentCanceled(pi);
        break;
      }
      case 'payment_intent.succeeded':
        // Informational — capture is handled in /api/stripe/capture-payment
        break;
      default:
        // Unhandled event type — return 200 to prevent Stripe retries
        break;
    }
  } catch (err) {
    console.error(`[webhook] Error handling ${event.type}:`, err);
    // Return 200 anyway — Stripe retries on non-2xx, which could cause loops
    // Log to monitoring; investigate separately
  }

  // 4. Always return 200 immediately — Stripe retries if no 2xx within 30s
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  const bookingId = pi.metadata?.bookingId;
  if (!bookingId) return;

  const bookingRef = adminDb.collection('bookings').doc(bookingId);
  const snap = await bookingRef.get();
  if (!snap.exists) return;

  const booking = snap.data()!;
  // Idempotency: only update if not already cancelled/complete
  if (booking.status === 'cancelled' || booking.status === 'complete') return;

  await bookingRef.update({ status: 'cancelled' });

  // Notify customer
  await adminDb.collection('notifications').add({
    userId: booking.customerId,
    type: 'booking_cancelled',
    title: 'Payment Failed',
    body: 'Your payment could not be processed. Your booking has been cancelled.',
    read: false,
    relatedBookingId: bookingId,
    relatedJobId: null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function handlePaymentCanceled(pi: Stripe.PaymentIntent): Promise<void> {
  const bookingId = pi.metadata?.bookingId;
  if (!bookingId) return;

  const bookingRef = adminDb.collection('bookings').doc(bookingId);
  const snap = await bookingRef.get();
  if (!snap.exists) return;

  const booking = snap.data()!;
  if (booking.status === 'cancelled' || booking.status === 'complete') return;

  await bookingRef.update({ status: 'cancelled' });
}
