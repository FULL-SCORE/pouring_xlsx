import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Supabase設定
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Stripe設定
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2025-07-30.basil" })
  : null;

interface Item {
  vid: string;
  title: string;
  price: number;
}

export async function POST(req: NextRequest) {
  const { items, updateTarget }: { items: Item[]; updateTarget: 'supabase' | 'stripe' | 'both' } =
    await req.json();

  const logs: string[] = [];

  for (const item of items) {
    const { vid, title, price } = item;

    // Supabase アップサート
    if (updateTarget === 'supabase' || updateTarget === 'both') {
      const { error } = await supabase.from('download_vid').upsert([{ vid, title, price }]);

      if (error) {
        logs.push(`❌ Supabase登録失敗: ${vid} (${error.message})`);
      } else {
        logs.push(`✅ Supabase登録成功: ${vid}`);
      }
    }

    // Stripe 登録 or 更新
    if ((updateTarget === 'stripe' || updateTarget === 'both') && stripe) {
      try {
        const response = await stripe.products.list({ limit: 100 });
        const foundProduct = response.data.find((product) => product.metadata.vid === vid);

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
      } catch (err) {
        logs.push(`❌ Stripe登録エラー: ${vid} (${(err as Error).message})`);
      }
    }
  }

  return NextResponse.json({ logs });
}
