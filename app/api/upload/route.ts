import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-07-30.basil' })
  : null;

type UploadItem = {
  vid: string;
  cut?: string;
  title?: string;
  keyword?: string;
  detail?: string;
  format?: string;
  framerate?: string;
  resolution?: string;
  metadata?: string;
  footageServer?: string;
  dulation?: string;
  DF?: string;
  push?: string;
  EX_ID?: string;
  '12K_ID'?: string;
  '8K_ID'?: string;
  '6K_ID'?: string;
  '4K_ID'?: string;
  EX_size?: string;
  '12K_size'?: string;
  '8K_size'?: string;
  '6K_size'?: string;
  '4K_size'?: string;
  EX_price?: string;
  '12K_price'?: string;
  '8K_price'?: string;
  '6K_price'?: string;
  '4K_price'?: string;
};

export async function POST(req: NextRequest) {
  const { items, updateTarget } = await req.json();
  const logs: string[] = [];

  for (const item of items as UploadItem[]) {
    const {
      vid, cut, title, keyword, detail, format, framerate, resolution, metadata,
      footageServer, dulation, DF, push, EX_ID, '12K_ID': id12K, '8K_ID': id8K,
      '6K_ID': id6K, '4K_ID': id4K, EX_size, '12K_size': size12K, '8K_size': size8K,
      '6K_size': size6K, '4K_size': size4K, EX_price, '12K_price': price12K,
      '8K_price': price8K, '6K_price': price6K, '4K_price': price4K
    } = item;

    // --- Supabase登録（video_info） ---
    if (updateTarget === 'supabase' || updateTarget === 'both') {
      const { error: error1 } = await supabase.from('video_info').upsert([
        {
          vid, cut, title, keyword, detail, format, framerate, resolution,
          metadata, footageServer, dulation, DF, push,
        },
      ]);
      if (error1) {
        logs.push(`❌ Supabase登録失敗: video_info ${vid} (${error1.message})`);
      } else {
        logs.push(`✅ Supabase登録成功: video_info ${vid}`);
      }

      // --- Supabase登録（download_vid） ---
      const { error: error2 } = await supabase.from('download_vid').upsert([
        {
          vid, EX_ID, '12K_ID': id12K, '8K_ID': id8K, '6K_ID': id6K, '4K_ID': id4K,
          EX_size, '12K_size': size12K, '8K_size': size8K, '6K_size': size6K, '4K_size': size4K,
        },
      ]);
      if (error2) {
        logs.push(`❌ Supabase登録失敗: download_vid ${vid} (${error2.message})`);
      } else {
        logs.push(`✅ Supabase登録成功: download_vid ${vid}`);
      }
    }

    // --- Stripe登録 ---
    if ((updateTarget === 'stripe' || updateTarget === 'both') && stripe && title) {
      try {
        const product = await stripe.products.create({
          name: `${title}_vid`,
          metadata: {
            vid,
            cut: cut ?? null,
            day: new Date().toISOString().slice(0, 10),
          },
        });
        logs.push(`✨ Stripe登録成功: ${product.id}`);

        const prices = [
          { key: 'EX', value: EX_price },
          { key: '12K', value: price12K },
          { key: '8K', value: price8K },
          { key: '6K', value: price6K },
          { key: '4K', value: price4K },
        ];

        for (const p of prices) {
          if (p.value) {
            await stripe.prices.create({
              unit_amount: Math.round(parseFloat(p.value) * 100),
              currency: 'jpy',
              product: product.id,
            });
            logs.push(`💰 Stripe価格追加: ${p.key}`);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          logs.push(`❌ Stripe登録エラー: ${vid} (${err.message})`);
        } else {
          logs.push(`❌ Stripe登録エラー: ${vid} (unknown error)`);
        }
      }      
    }
  }

  return NextResponse.json({ message: '✅ 完了しました', logs });
}
