import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripeTest, stripeLive } from '@/lib/stripe';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const schema = z.object({
  json: z.array(z.record(z.string(), z.any())),
  service: z.string(),
  stripeEnv: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const { json, service, stripeEnv } = schema.parse(body);
  const stripe = stripeEnv === 'live' ? stripeLive : stripeTest;

  const supabaseLogs: string[] = [];
  const stripeLogs: string[] = [];

  for (const row of json) {
    const {
      vid,
      cut,
      title,
      keyword,
      detail,
      format,
      framerate,
      resolution,
      metadata,
      footageServer,
      dulation,
      DF,
      push,
      EX_ID,
      '12K_ID': ID_12K,
      '8K_ID': ID_8K,
      '6K_ID': ID_6K,
      '4K_ID': ID_4K,
      EX_size,
      '12K_size': size_12K,
      '8K_size': size_8K,
      '6K_size': size_6K,
      '4K_size': size_4K,
      EX_price,
      '12K_price': price_12K,
      '8K_price': price_8K,
      '6K_price': price_6K,
      '4K_price': price_4K,
      thumb,
    } = row;

    // ---------- Supabase ----------
    if (service !== 'stripe') {
      const videoInfoData = {
        vid,
        cut,
        title: `${title}${cut}`,
        keyword,
        detail,
        format,
        framerate,
        resolution: JSON.stringify(JSON.parse(resolution)),
        metadata: JSON.stringify(JSON.parse(metadata)),
        footageServer,
        dulation,
        DF,
        push,
      };

      const downloadVidData = {
        vid,
        EX_ID,
        '12K_ID': ID_12K,
        '8K_ID': ID_8K,
        '6K_ID': ID_6K,
        '4K_ID': ID_4K,
        EX_size,
        '12K_size': size_12K,
        '8K_size': size_8K,
        '6K_size': size_6K,
        '4K_size': size_4K,
      };

      const { error: videoInfoError } = await supabase
        .from('video_info')
        .upsert(videoInfoData, { onConflict: 'vid' });
      const { error: downloadVidError } = await supabase
        .from('download_vid')
        .upsert(downloadVidData, { onConflict: 'vid' });

      if (videoInfoError || downloadVidError) {
        supabaseLogs.push(`❌ ${vid} 登録失敗`);
      } else {
        supabaseLogs.push(`✅ ${vid} 登録成功`);
      }
    }

    // ---------- Stripe ----------
    if (service !== 'supabase') {
      const formattedTitle = `${title.replace(/\(.*?\)/g, '').trim()}${cut}_${vid}`;

      // thumb列から画像URLを抽出
      let imageUrl: string | undefined = undefined;
      if (typeof thumb === 'string') {
        const match = thumb.match(/https?:\/\/[^\")]+/);
        if (match) {
          imageUrl = match[0].trim();
        }
      }

      const productList = await stripe.products.list({ limit: 100 });
      const existingProduct = productList.data.find(
        (p) => p.name === formattedTitle
      );

      let product;
      if (existingProduct) {
        product = await stripe.products.update(existingProduct.id, {
          name: formattedTitle,
          images: imageUrl ? [imageUrl] : undefined,
          metadata: { vid, day: new Date().toISOString().slice(0, 10), cut: String(cut) },
        });
      } else {
        product = await stripe.products.create({
          name: formattedTitle,
          images: imageUrl ? [imageUrl] : undefined,
          metadata: { vid, day: new Date().toISOString().slice(0, 10), cut: String(cut) },
        });
      }

      const prices = [
        { amount: EX_price, quality: 'EX' },
        { amount: price_12K, quality: '12K' },
        { amount: price_8K, quality: '8K' },
        { amount: price_6K, quality: '6K' },
        { amount: price_4K, quality: '4K' },
      ];

      const existingPrices = await stripe.prices.list({
        product: product.id,
        limit: 100,
      });

      for (const { amount, quality } of prices) {
        if (!amount) continue;

        const unitAmount = parseInt(amount, 10);
        const matched = existingPrices.data.find(
          (p) => p.nickname === quality && p.unit_amount === unitAmount && p.currency === 'jpy'
        );

        if (!matched) {
          await stripe.prices.create({
            unit_amount: unitAmount,
            currency: 'jpy',
            product: product.id,
            nickname: quality,
            metadata: { quality },
          });
        }
      }

      stripeLogs.push(`🟢 ${formattedTitle} 処理完了`);
    }
  }

  return NextResponse.json({
    supabaseLogs,
    stripeLogs,
  });
}
