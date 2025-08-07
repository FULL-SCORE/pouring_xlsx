// lib/stripe.ts
import Stripe from 'stripe';

export const stripeTest = new Stripe(process.env.STRIPE_SECRET_KEY_TEST!, {
  apiVersion: '2025-07-30.basil',
});

export const stripeLive = new Stripe(process.env.STRIPE_SECRET_KEY_LIVE!, {
  apiVersion: '2025-07-30.basil',
});

