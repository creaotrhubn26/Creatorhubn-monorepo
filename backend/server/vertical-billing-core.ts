/**
 * Felles Stripe-init for vertikal-billing (dans, spillstudio).
 * Ren flytting av `getStripe` fra dance-billing-service.ts — samme
 * miljøvariabler, samme singleton.
 */

import Stripe from 'stripe';

let stripeClient: Stripe | null = null;
export function getStripe(): Stripe | null {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY
    || process.env.CREATORHUB_STRIPE_SECRET_KEY
    || process.env.STRIPE_API_KEY;
  if (!key) return null;
  stripeClient = new Stripe(key);
  return stripeClient;
}
