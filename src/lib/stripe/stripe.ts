/**
 * Stripe Server SDK — server-side only.
 * NEVER import this file in components or client-side code.
 * Only use in: src/app/api/** Route Handlers.
 *
 * For client-side Stripe (Elements, confirmPayment), use:
 *   import { loadStripe } from '@stripe/stripe-js'
 */

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});

export default stripe;
