/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Supabase設定
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Stripe設定（環境変数がない場合はnullでバイパス）
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2025-07-30.basil" })
  : null;

export async function POST(req: NextRequest) {
  const { items, updateTarget } = await req.json();

  const logs: string[] = [];

  for (const item of items) {
    const { vid, title, price } = item;

    // 🔄 Supabaseにアップサート
    if (updateTarget === 'supabase' || updateTarget === 'both') {
      const { error } = await supabase.from('download_vid').upsert([
        {
          vid,
          title,
          price,
        },
      ]);

      if (error) {
        logs.push(`❌ Supabase登録失敗: ${vid} (${error.message})`);
      } else {
        logs.push(`✅ Supabase登録成功: ${vid}`);
      }
    }

    // 💳 Stripeに登録/更新
    if ((updateTarget === 'stripe' || updateTarget === 'both') && stripe) {
      try {
        const response = await stripe.products.list({ limit: 100 });
        const foundProduct = response.data.find(
          (product) => product.metadata.vid === vid
        );

        if (foundProduct) {
          await stripe.products.update(foundProduct.id, {
            name: `${title}_vid`,
            metadata: { vid },
          });
          logs.push(`🔁 Stripe更新成功: ${vid}`);
        } else {
          await stripe.products.create({
            name: `${title}_vid`,
            metadata: { vid },
          });
          logs.push(`✨ Stripe新規作成成功: ${vid}`);
        }
      } catch (err: any) {
        logs.push(`❌ Stripe登録エラー: ${vid} (${err.message})`);
      }
    }
  }

  return NextResponse.json({ logs });
}