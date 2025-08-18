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
    } = row;

    const vidStr = String(vid);

    // ---------- Supabase ----------
    if (service !== 'stripe') {
      const cleanResolution = String(resolution).replace(/^"(.*)"$/, '$1').replace(/\//g, '');
      const cleanMetadata = String(metadata).replace(/^"(.*)"$/, '$1').replace(/\//g, '');

      const videoInfoData = {
        vid,
        cut,
        title: `${title}${cut}`,
        keyword,
        detail,
        format,
        framerate,
        resolution: cleanResolution,
        metadata: cleanMetadata,
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

      // video_info の存在確認
      const { data: existingVideoInfo } = await supabase
        .from('video_info')
        .select('vid')
        .eq('vid', vid);

      const isNewVideoInfo = !existingVideoInfo || existingVideoInfo.length === 0;

      const { error: videoInfoError } = await supabase
        .from('video_info')
        .upsert(videoInfoData, { onConflict: 'vid' });

      // download_vid の存在確認
      const { data: existingDownloadVid } = await supabase
        .from('download_vid')
        .select('vid')
        .eq('vid', vid);

      const isNewDownloadVid = !existingDownloadVid || existingDownloadVid.length === 0;

      const { error: downloadVidError } = await supabase
        .from('download_vid')
        .upsert(downloadVidData, { onConflict: 'vid' });

      if (videoInfoError || downloadVidError) {
        supabaseLogs.push(`❌ ${vid} 登録失敗`);
      } else {
        const status = [
          isNewVideoInfo ? '新規' : '更新',
          isNewDownloadVid ? '新規' : '更新'
        ].join('/');
        supabaseLogs.push(`✅ ${vid} 登録成功（${status}）`);
      }
    }

    // ---------- Stripe ----------
    if (service !== 'supabase') {
      const formattedTitle = `${title.replace(/\(.*?\)/g, '').trim()}${cut}_${vid}`;

      let imageUrl: string | undefined = undefined;
      if (vidStr.length >= 12) {
        const folderRaw = vidStr.slice(4, 10);
        const folder = `${folderRaw.slice(0, 4)}_${folderRaw.slice(4, 6)}`;
        imageUrl = `https://expix-ft.jp/ex/footage/${folder}/720/${vidStr}.jpg`;
      }

      const allProducts = await stripe.products.list({ limit: 100 }).autoPagingToArray({ limit: 1000 });
      const existingProduct = allProducts.find(p => p.metadata?.vid === vidStr);

      let product;
      if (existingProduct) {
        product = await stripe.products.update(existingProduct.id, {
          name: formattedTitle,
          images: imageUrl ? [imageUrl] : undefined,
          metadata: {
            vid,
            day: new Date().toISOString().slice(0, 10),
            cut: String(cut),
          },
        });

        stripeLogs.push(`🟡 ${formattedTitle} 商品更新`);
      } else {
        product = await stripe.products.create({
          name: formattedTitle,
          images: imageUrl ? [imageUrl] : undefined,
          metadata: {
            vid,
            day: new Date().toISOString().slice(0, 10),
            cut: String(cut),
          },
        });

        stripeLogs.push(`🟢 ${formattedTitle} 商品新規作成`);
      }

      const allPrices = await stripe.prices.list({ product: product.id, limit: 100 }).autoPagingToArray({ limit: 1000 });

      for (const { amount, quality } of [
        { amount: EX_price, quality: 'EX' },
        { amount: price_12K, quality: '12K' },
        { amount: price_8K, quality: '8K' },
        { amount: price_6K, quality: '6K' },
        { amount: price_4K, quality: '4K' },
      ]) {
        if (!amount) continue;
        const unitAmount = parseInt(amount, 10);

        const alreadyExists = allPrices.some(
          p =>
            p.unit_amount === unitAmount &&
            p.nickname === quality &&
            p.active === true
        );

        if (alreadyExists) {
          stripeLogs.push(`⏩ ${formattedTitle} - ${quality}（重複価格スキップ）`);
          continue;
        }

        for (const price of allPrices) {
          if (price.active) {
            await stripe.prices.update(price.id, { active: false });
          }
        }

        await stripe.prices.create({
          unit_amount: unitAmount,
          currency: 'jpy',
          product: product.id,
          nickname: quality,
          metadata: { quality },
        });

        stripeLogs.push(`✅ ${formattedTitle} - ${quality}（価格新規作成）`);
      }
    }
  }

  return NextResponse.json({
    supabaseLogs,
    stripeLogs,
  });
}
