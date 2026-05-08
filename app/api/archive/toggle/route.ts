import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { z } from 'zod';

const schema = z.object({
  targetEnv: z.enum(['test', 'live']),
  product_id: z.string().min(1),
  active: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { targetEnv, product_id, active } = schema.parse(body);

    const supabaseUrl =
      targetEnv === 'live'
        ? process.env.SUPABASE_URL_LIVE!
        : process.env.SUPABASE_URL_TEST!;

    const supabaseKey =
      targetEnv === 'live'
        ? process.env.SUPABASE_SERVICE_ROLE_KEY_LIVE!
        : process.env.SUPABASE_SERVICE_ROLE_KEY_TEST!;

    const stripeKey =
      targetEnv === 'live'
        ? process.env.STRIPE_SECRET_KEY_LIVE!
        : process.env.STRIPE_SECRET_KEY_TEST!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-07-30.basil',
    });

    // 1. Stripe側の商品を有効 / アーカイブ切替
    const product = await stripe.products.update(product_id, {
      active,
    });

    // 2. Supabase側のstripe_products.activeも更新
    const { error } = await supabase
      .from('stripe_products')
      .update({
        active: product.active,
      })
      .eq('product_id', product_id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      product_id,
      active: product.active,
      message: active ? '商品を有効化しました。' : '商品をアーカイブしました。',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
      },
      {
        status: 500,
      }
    );
  }
}