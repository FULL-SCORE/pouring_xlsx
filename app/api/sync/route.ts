import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  json: z.array(z.record(z.string(), z.any())),
  service: z.enum(['supabase', 'stripe', 'both']),
  targetEnv: z.enum(['test', 'live']),
  fileName: z.string().optional(),
});

type TargetEnv = 'test' | 'live';

function getEnvironmentVariables(targetEnv: TargetEnv) {
  const supabaseUrl =
    targetEnv === 'live'
      ? process.env.SUPABASE_URL_LIVE
      : process.env.SUPABASE_URL_TEST;

  const supabaseKey =
    targetEnv === 'live'
      ? process.env.SUPABASE_SERVICE_ROLE_KEY_LIVE
      : process.env.SUPABASE_SERVICE_ROLE_KEY_TEST;

  const stripeKey =
    targetEnv === 'live'
      ? process.env.STRIPE_SECRET_KEY_LIVE
      : process.env.STRIPE_SECRET_KEY_TEST;

  if (!supabaseUrl) {
    throw new Error(
      `${targetEnv}環境のSupabase URLが設定されていません。`
    );
  }

  if (!supabaseKey) {
    throw new Error(
      `${targetEnv}環境のSupabase Service Role Keyが設定されていません。`
    );
  }

  if (!stripeKey) {
    throw new Error(
      `${targetEnv}環境のStripe Secret Keyが設定されていません。`
    );
  }

  return {
    supabaseUrl,
    supabaseKey,
    stripeKey,
  };
}

function sortResolutionByLabelPriority(
  resolution: Record<string, string>
): Record<string, string> {
  const priority = ['12K', '8K', '6K', '4K', 'EX'];

  return Object.fromEntries(
    Object.entries(resolution).sort(([a], [b]) => {
      const aIndex = priority.indexOf(a);
      const bIndex = priority.indexOf(b);

      const normalizedAIndex =
        aIndex === -1 ? priority.length : aIndex;

      const normalizedBIndex =
        bIndex === -1 ? priority.length : bIndex;

      return normalizedAIndex - normalizedBIndex;
    })
  );
}

function parseJsonValue(
  value: unknown
): Record<string, unknown> {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return {};
    }

    try {
      const parsed = JSON.parse(trimmedValue);

      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }

      return {};
    } catch {
      return {};
    }
  }

  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

function emptyToNull(value: unknown) {
  return value === '' ||
    value === undefined ||
    value === null
    ? null
    : value;
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

function createStripeProductDataFromCsv(
  row: Record<string, any>
) {
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

function createImageUrl(vid: string) {
  if (vid.length < 12) {
    return undefined;
  }

  const folderRaw = vid.slice(4, 10);

  const folder = `${folderRaw.slice(0, 4)}_${folderRaw.slice(
    4,
    6
  )}`;

  return `https://expix-ft.jp/ex/footage/${folder}/720/${vid}.jpg`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { json, service, targetEnv, fileName } =
      schema.parse(body);

    const { supabaseUrl, supabaseKey, stripeKey } =
      getEnvironmentVariables(targetEnv);

    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-07-30.basil',
    });

    const supabaseLogs: string[] = [];
    const stripeLogs: string[] = [];

    /*
     * Stripeの商品一覧を最初に一度だけ取得します。
     *
     * アーカイブ済みの商品も含めて取得し、
     * metadata.vidでMapを作成します。
     */
    const stripeProductsByVid = new Map<
      string,
      Stripe.Product
    >();

    if (service !== 'supabase') {
      for await (const product of stripe.products.list({
        limit: 100,
      })) {
        const productVid = product.metadata?.vid;

        if (!productVid) {
          continue;
        }

        const existingMappedProduct =
          stripeProductsByVid.get(productVid);

        /*
         * 同じvidの商品が複数存在する場合は、
         * 有効な商品を優先します。
         */
        if (
          !existingMappedProduct ||
          (!existingMappedProduct.active && product.active)
        ) {
          stripeProductsByVid.set(productVid, product);
        }
      }

      stripeLogs.push(
        `既存Stripe商品を${stripeProductsByVid.size}件読み込みました。`
      );
    }

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
        footage_server,
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

      const resolvedFootageServer =
        footageServer ?? footage_server;

      /*
       * stripe_productsをエクスポートしたCSVを
       * 直接戻す処理です。
       *
       * serviceがStripeのみの場合は実行しません。
       */
      if (row.product_id && service !== 'stripe') {
        const stripeProductData =
          createStripeProductDataFromCsv(row);

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
          supabaseLogs.push(
            `${row.product_id} stripe_products CSV登録成功`
          );
        }
      }

      if (
        vid === '' ||
        vid === null ||
        vid === undefined
      ) {
        supabaseLogs.push('vidなしの行をスキップしました。');
        continue;
      }

      const vidStr = String(vid).trim();

      if (!vidStr) {
        supabaseLogs.push('vidが空の行をスキップしました。');
        continue;
      }

      /*
       * Supabase:
       * video_info / download_vid
       */
      if (service !== 'stripe') {
        const resolutionObj = parseJsonValue(
          resolution
        ) as Record<string, string>;

        const sortedResolution =
          sortResolutionByLabelPriority(resolutionObj);

        const metadataObj = parseJsonValue(metadata);

        const safeTitle =
          title === null || title === undefined
            ? ''
            : String(title);

        const safeCut =
          cut === null || cut === undefined
            ? ''
            : String(cut);

        const videoInfoData = {
          vid,
          cut: emptyToNull(cut),
          title: `${safeTitle}${safeCut}`,
          keyword: emptyToNull(keyword),
          detail: emptyToNull(detail),
          format: emptyToNull(format),
          framerate: emptyToNull(framerate),
          resolution: sortedResolution,
          metadata: metadataObj,
          footageServer: emptyToNull(
            resolvedFootageServer
          ),
          dulation: emptyToNull(dulation),
          DF: emptyToNull(DF),
          push: toBoolean(push),
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
            `${vidStr} video_info失敗: ${videoInfoError.message}`
          );
        } else {
          supabaseLogs.push(
            `${vidStr} video_info成功`
          );
        }

        const { error: downloadVidError } =
          await supabase
            .from('download_vid')
            .upsert(downloadVidData, {
              onConflict: 'vid',
            });

        if (downloadVidError) {
          supabaseLogs.push(
            `${vidStr} download_vid失敗: ${downloadVidError.message}`
          );
        } else {
          supabaseLogs.push(
            `${vidStr} download_vid成功`
          );
        }
      }

      /*
       * Stripe商品・価格作成
       */
      if (service !== 'supabase') {
        const safeTitle =
          title === null || title === undefined
            ? ''
            : String(title);

        const safeCut =
          cut === null || cut === undefined
            ? ''
            : String(cut);

        const formattedTitle = `${safeTitle
          .replace(/\(.*?\)/g, '')
          .trim()}${safeCut}_${vidStr}`;

        const imageUrl = createImageUrl(vidStr);

        const existingProduct =
          stripeProductsByVid.get(vidStr);

        let product: Stripe.Product;

        if (existingProduct) {
          /*
           * 既存商品を再利用します。
           *
           * リセット処理でアーカイブされていても、
           * active:trueでアーカイブ解除します。
           */
          product = await stripe.products.update(
            existingProduct.id,
            {
              active: true,
              name: formattedTitle,
              images: imageUrl ? [imageUrl] : undefined,
              metadata: {
                ...existingProduct.metadata,
                vid: vidStr,
                day: new Date()
                  .toISOString()
                  .slice(0, 10),
                cut: safeCut,
              },
            }
          );

          stripeProductsByVid.set(vidStr, product);

          stripeLogs.push(
            existingProduct.active
              ? `${formattedTitle} 商品更新`
              : `${formattedTitle} 商品更新・アーカイブ解除`
          );
        } else {
          /*
           * metadata.vidが一致する商品がない場合だけ
           * 新規作成します。
           */
          product = await stripe.products.create({
            active: true,
            name: formattedTitle,
            images: imageUrl ? [imageUrl] : undefined,
            metadata: {
              vid: vidStr,
              day: new Date()
                .toISOString()
                .slice(0, 10),
              cut: safeCut,
            },
          });

          stripeProductsByVid.set(vidStr, product);

          stripeLogs.push(
            `${formattedTitle} 商品新規作成`
          );
        }

        /*
         * Stripe側の商品情報をSupabaseの
         * stripe_productsへ再登録します。
         *
         * serviceがStripeのみの場合でも、
         * 元コードと同じくstripe_productsへ保存します。
         */
        const stripeProductSupabaseData =
          createStripeProductDataFromStripe({
            product,
            vid,
            cut,
            footageServer: resolvedFootageServer,
          });

        const { error: stripeProductError } =
          await supabase
            .from('stripe_products')
            .upsert(stripeProductSupabaseData, {
              onConflict: 'product_id',
            });

        if (stripeProductError) {
          supabaseLogs.push(
            `${formattedTitle} stripe_products失敗: ${stripeProductError.message}`
          );
        } else {
          supabaseLogs.push(
            `${formattedTitle} stripe_products成功`
          );
        }

        /*
         * 商品に紐づく既存Priceを取得します。
         */
        const allPrices: Stripe.Price[] = [];

        for await (const price of stripe.prices.list({
          product: product.id,
          limit: 100,
        })) {
          allPrices.push(price);
        }

        const priceDefinitions = [
          {
            amount: EX_price,
            quality: 'EX',
          },
          {
            amount: price_12K,
            quality: '12K',
          },
          {
            amount: price_8K,
            quality: '8K',
          },
          {
            amount: price_6K,
            quality: '6K',
          },
          {
            amount: price_4K,
            quality: '4K',
          },
        ];

        for (const {
          amount,
          quality,
        } of priceDefinitions) {
          if (
            amount === '' ||
            amount === null ||
            amount === undefined
          ) {
            continue;
          }

          const unitAmount = Number.parseInt(
            String(amount).replace(/,/g, ''),
            10
          );

          if (Number.isNaN(unitAmount)) {
            stripeLogs.push(
              `${formattedTitle} ${quality} 価格不正のためスキップ`
            );
            continue;
          }

          const alreadyExists = allPrices.some(
            (price) =>
              price.unit_amount === unitAmount &&
              price.currency === 'jpy' &&
              price.nickname === quality &&
              price.active
          );

          if (alreadyExists) {
            stripeLogs.push(
              `${formattedTitle} ${quality} 既存価格を使用`
            );
            continue;
          }

          const createdPrice = await stripe.prices.create({
            unit_amount: unitAmount,
            currency: 'jpy',
            product: product.id,
            nickname: quality,
          });

          allPrices.push(createdPrice);

          stripeLogs.push(
            `${formattedTitle} ${quality} 価格作成`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      fileName: fileName ?? null,
      supabaseLogs,
      stripeLogs,
    });
  } catch (error) {
    console.error('同期処理エラー:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'アップロードデータの形式が正しくありません。',
          details: error.flatten(),
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : '同期処理に失敗しました。',
      },
      {
        status: 500,
      }
    );
  }
}