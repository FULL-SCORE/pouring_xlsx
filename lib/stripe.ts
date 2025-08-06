import Stripe from 'stripe';

console.log('✅ STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY);

const mode = process.env.NEXT_PUBLIC_STRIPE_MODE === 'live' ? 'live' : 'test';
const secretKey = process.env.STRIPE_SECRET_KEY;


    if (!secretKey) {
        console.error('❌ Stripe secret key is not defined');
        throw new Error('Stripe secret key is not defined');
      }

export const stripe = new Stripe(secretKey, {
  apiVersion: "2025-07-30.basil"
});