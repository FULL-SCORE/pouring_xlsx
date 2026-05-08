import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { z } from 'zod';

const schema = z.object({
  json: z.array(z.record(z.string(), z.any())),
  service: z.enum(['supabase', 'stripe', 'both']),
  targetEnv: z.enum(['test', 'live']),
});

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

function emptyToNull(value: unknown) {
  return value === '' || value === undefined ? null : value;
}

function toBoolean(value: unknown) {
  return (
    value === true ||
    value === 'true' ||
    value === 'TRUE' ||
    value === '1' ||
    value === 1
  );
}

function createStripeProductDataFromCsv(row: Record<string, any>) {
  return {
    id: emptyToNull(row.id),
    product_id: emptyToNull(row.product_id),
    created_at: emptyToNull(row.created_at),
    name: emptyToNull(row.name),
    metadata: parseJsonValue(row.metadata),
    footage_server: emptyToNull(row.footage_server),
    created: emptyToNull(row.created),
    active: toBoolean(row.active),
    cut: emptyToNull(row.cut),
    day: emptyToNull(row.day),
    meta_vid: emptyToNull(row.meta_vid),
  };
}

function createStripeProductDataFromStripe(params: {
  product: Stripe.Product;
  vid: unknown;
  cut: unknown;
  footageServer: unknown;
}) {
  const { product, vid, cut, footageServer } = params;

  return {
    product_id: product.id,
    name: product.name,
    metadata: product.metadata ?? {},
    footage_server: emptyToNull(footageServer),
    created: new Date(product.created * 1000).toISOString(),
    active: product.active,
    cut: emptyToNull(cut),
    day: new Date().toISOString().slice(0, 10),
    meta_vid: emptyToNull(String(vid)),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { json, service, targetEnv } = schema.parse(body);

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

      // =========================
      // stripe_products CSV直接登録用
      // product_id がCSV内にある場合
      // =========================

      if (row.product_id && service !== 'stripe') {
        const stripeProductData = createStripeProductDataFromCsv(row);

        const { error } = await supabase
          .from('stripe_products')
          .upsert(stripeProductData, {
            onConflict: 'product_id',
          });

        if (error) {
          supabaseLogs.push(
            `${row.product_id} stripe_products CSV登録失敗: ${error.message}`
          );
        } else {
          supabaseLogs.push(`${row.product_id} stripe_products CSV登録成功`);
        }
      }

      if (!vid) {
        supabaseLogs.push('vidなしスキップ');
        continue;
      }

      // =========================
      // Supabase: video_info / download_vid
      // =========================

      if (service !== 'stripe') {
        const resolutionObj = parseJsonValue(
          resolution
        ) as Record<string, string>;

        const sortedResolution =
          sortResolutionByLabelPriority(resolutionObj);

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

        const downloadVidData = {
          vid,
          EX_ID: emptyToNull(EX_ID),
          '12K_ID': emptyToNull(ID_12K),
          '8K_ID': emptyToNull(ID_8K),
          '6K_ID': emptyToNull(ID_6K),
          '4K_ID': emptyToNull(ID_4K),
          EX_size: emptyToNull(EX_size),
          '12K_size': emptyToNull(size_12K),
          '8K_size': emptyToNull(size_8K),
          '6K_size': emptyToNull(size_6K),
          '4K_size': emptyToNull(size_4K),
        };

        const { error: videoInfoError } = await supabase
          .from('video_info')
          .upsert(videoInfoData, {
            onConflict: 'vid',
          });

        if (videoInfoError) {
          supabaseLogs.push(
            `${vid} video_info 失敗: ${videoInfoError.message}`
          );
        } else {
          supabaseLogs.push(`${vid} video_info 成功`);
        }

        const { error: downloadVidError } = await supabase
          .from('download_vid')
          .upsert(downloadVidData, {
            onConflict: 'vid',
          });

        if (downloadVidError) {
          supabaseLogs.push(
            `${vid} download_vid 失敗: ${downloadVidError.message}`
          );
        } else {
          supabaseLogs.push(`${vid} download_vid 成功`);
        }
      }

      // =========================
      // Stripe 商品・価格作成
      // 作成/更新後に stripe_products へ保存
      // =========================

      if (service !== 'supabase') {
        const safeTitle = title ? String(title) : '';
        const safeCut = cut ? String(cut) : '';

        const formattedTitle = `${safeTitle
          .replace(/\(.*?\)/g, '')
          .trim()}${safeCut}_${vid}`;

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

        let product: Stripe.Product;

        if (existingProduct) {
          product = await stripe.products.update(existingProduct.id, {
            name: formattedTitle,
            images: imageUrl ? [imageUrl] : undefined,
            metadata: {
              vid: vidStr,
              day: new Date().toISOString().slice(0, 10),
              cut: safeCut,
            },
          });

          stripeLogs.push(`${formattedTitle} 商品更新`);
        } else {
          product = await stripe.products.create({
            name: formattedTitle,
            images: imageUrl ? [imageUrl] : undefined,
            metadata: {
              vid: vidStr,
              day: new Date().toISOString().slice(0, 10),
              cut: safeCut,
            },
          });

          stripeLogs.push(`${formattedTitle} 商品作成`);
        }

        // =========================
        // ここが重要：
        // Stripe作成/更新後の product.id を stripe_products に保存
        // =========================

        const stripeProductSupabaseData = createStripeProductDataFromStripe({
          product,
          vid,
          cut,
          footageServer,
        });

        const { error: stripeProductError } = await supabase
          .from('stripe_products')
          .upsert(stripeProductSupabaseData, {
            onConflict: 'product_id',
          });

        if (stripeProductError) {
          supabaseLogs.push(
            `${formattedTitle} stripe_products 失敗: ${stripeProductError.message}`
          );
        } else {
          supabaseLogs.push(`${formattedTitle} stripe_products 成功`);
        }

        const allPrices = await stripe.prices
          .list({
            product: product.id,
            limit: 100,
          })
          .autoPagingToArray({ limit: 1000 });

        for (const { amount, quality } of [
          { amount: EX_price, quality: 'EX' },
          { amount: price_12K, quality: '12K' },
          { amount: price_8K, quality: '8K' },
          { amount: price_6K, quality: '6K' },
          { amount: price_4K, quality: '4K' },
        ]) {
          if (!amount) continue;

          const unitAmount = parseInt(String(amount), 10);

          if (Number.isNaN(unitAmount)) {
            stripeLogs.push(`${formattedTitle} ${quality} 価格不正のためスキップ`);
            continue;
          }

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
      {
        error: (error as Error).message,
      },
      {
        status: 500,
      }
    );
  }
}