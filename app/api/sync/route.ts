import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { z } from 'zod';

const schema = z.object({
  json: z.array(z.record(z.string(), z.any())),
  service: z.enum(['supabase', 'stripe', 'both']),
  targetEnv: z.enum(['test', 'live']),
});

// 解像度ソート
function sortResolutionByLabelPriority(
  resolution: Record<string, string>
): Record<string, string> {
  const priority = ['12K', '8K', '6K', '4K', 'EX'];

  return Object.fromEntries(
    Object.entries(resolution).sort(
      ([a], [b]) => priority.indexOf(a) - priority.indexOf(b)
    )
  );
}

// JSON安全パース
function parseJsonValue(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

// ★今回の重要ポイント
function emptyToNull(value: unknown) {
  return value === '' || value === undefined ? null : value;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { json, service, targetEnv } = schema.parse(body);

    // =========================
    // 環境切り替え
    // =========================

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

    const supabaseLogs: string[] = [];
    const stripeLogs: string[] = [];

    // =========================
    // メイン処理
    // =========================

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
        '4K_ID': ID_4,
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

      if (!vid) {
        supabaseLogs.push('vidなしスキップ');
        continue;
      }

      // =========================
      // Supabase
      // =========================

      if (service !== 'stripe') {
        const resolutionObj = parseJsonValue(resolution) as Record<string, string>;
        const sortedResolution = sortResolutionByLabelPriority(resolutionObj);
        const metadataObj = parseJsonValue(metadata);

        const videoInfoData = {
          vid,
          cut,
          title: `${title}${cut}`,
          keyword,
          detail,
          format,
          framerate,
          resolution: sortedResolution,
          metadata: metadataObj,
          footageServer,
          dulation,
          DF,
          push,
        };

        // ★ここが修正ポイント
        const downloadVidData = {
          vid,
          EX_ID: emptyToNull(EX_ID),
          '12K_ID': emptyToNull(ID_12K),
          '8K_ID': emptyToNull(ID_8K),
          '6K_ID': emptyToNull(ID_6K),
          '4K_ID': emptyToNull(ID_4),
          EX_size: emptyToNull(EX_size),
          '12K_size': emptyToNull(size_12K),
          '8K_size': emptyToNull(size_8K),
          '6K_size': emptyToNull(size_6K),
          '4K_size': emptyToNull(size_4K),
        };

        const { error: videoInfoError } = await supabase
          .from('video_info')
          .upsert(videoInfoData, { onConflict: 'vid' });

        if (videoInfoError) {
          supabaseLogs.push(`${vid} video_info 失敗: ${videoInfoError.message}`);
        } else {
          supabaseLogs.push(`${vid} video_info 成功`);
        }

        const { error: downloadVidError } = await supabase
          .from('download_vid')
          .upsert(downloadVidData, { onConflict: 'vid' });

        if (downloadVidError) {
          supabaseLogs.push(`${vid} download_vid 失敗: ${downloadVidError.message}`);
        } else {
          supabaseLogs.push(`${vid} download_vid 成功`);
        }
      }

      // =========================
      // Stripe
      // =========================

      if (service !== 'supabase') {
        const formattedTitle = `${title.replace(/\(.*?\)/g, '').trim()}${cut}_${vid}`;
        const vidStr = String(vid);

        let imageUrl: string | undefined;

        if (vidStr.length >= 12) {
          const folderRaw = vidStr.slice(4, 10);
          const folder = `${folderRaw.slice(0, 4)}_${folderRaw.slice(4, 6)}`;
          imageUrl = `https://expix-ft.jp/ex/footage/${folder}/720/${vidStr}.jpg`;
        }

        const allProducts = await stripe.products
          .list({ limit: 100 })
          .autoPagingToArray({ limit: 1000 });

        const existingProduct = allProducts.find(
          (p) => p.metadata?.vid === vidStr
        );

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
          stripeLogs.push(`${formattedTitle} 商品更新`);
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
          stripeLogs.push(`${formattedTitle} 商品作成`);
        }

        const allPrices = await stripe.prices
          .list({ product: product.id, limit: 100 })
          .autoPagingToArray({ limit: 1000 });

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
            (p) =>
              p.unit_amount === unitAmount &&
              p.nickname === quality &&
              p.active
          );

          if (alreadyExists) {
            stripeLogs.push(`${formattedTitle} ${quality} スキップ`);
            continue;
          }

          await stripe.prices.create({
            unit_amount: unitAmount,
            currency: 'jpy',
            product: product.id,
            nickname: quality,
          });

          stripeLogs.push(`${formattedTitle} ${quality} 価格作成`);
        }
      }
    }

    return NextResponse.json({
      supabaseLogs,
      stripeLogs,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}