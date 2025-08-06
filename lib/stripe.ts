import Stripe from 'stripe';

const mode = process.env.NEXT_PUBLIC_STRIPE_MODE === 'live' ? 'live' : 'test';
const secretKey =
  mode === 'live'
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;

if (!secretKey) throw new Error('Stripe secret key is not defined');

export const stripe = new Stripe(secretKey, {
  apiVersion: "2025-07-30.basil"
});