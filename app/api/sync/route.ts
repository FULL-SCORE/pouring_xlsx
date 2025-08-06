import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

interface UploadItem {
  vid: string;
  title: string;
  price: number;
}

interface SyncRequest {
  items: UploadItem[];
  updateTarget: 'supabase' | 'stripe' | 'both';
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2025-07-30.basil" })
  : null;

export async function POST(req: NextRequest) {
  const { items, updateTarget } = (await req.json()) as SyncRequest;

  const logs: string[] = [];

  for (const item of items) {
    const { vid, title, price } = item;

    if (updateTarget === 'supabase' || updateTarget === 'both') {
      const { error } = await supabase.from('download_vid').upsert([{ vid, title, price }]);

      if (error) logs.push(`❌ Supabase登録失敗: ${vid} (${error.message})`);
      else logs.push(`✅ Supabase登録成功: ${vid}`);
    }

    if ((updateTarget === 'stripe' || updateTarget === 'both') && stripe) {
      try {
        const existing = await stripe.products.list({ limit: 100 });
        const match = existing.data.find(p => p.metadata.vid === vid);

        if (match) {
          await stripe.products.update(match.id, {
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
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logs.push(`❌ Stripe登録エラー: ${vid} (${msg})`);
      }
    }
  }

  return NextResponse.json({ logs });
}
