import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  targetEnv: z.enum(['test', 'live']),
  confirmation: z.string(),
});

type TargetEnv = 'test' | 'live';

type FailedProduct = {
  productId: string;
  name: string;
  error: string;
};

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

/**
 * 指定時間待機します。
 */
function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * StripeエラーからHTTPステータスを取得します。
 */
function getStripeStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const stripeError = error as {
    statusCode?: number;
    status?: number;
    raw?: {
      statusCode?: number;
    };
  };

  return (
    stripeError.statusCode ??
    stripeError.status ??
    stripeError.raw?.statusCode
  );
}

/**
 * Stripeエラーの内容を文字列化します。
 */
function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Stripe商品をアーカイブします。
 *
 * 429の場合だけ指数バックオフで再試行します。
 */
async function archiveProductWithRetry(params: {
  stripe: Stripe;
  product: Stripe.Product;
  maxRetries?: number;
}) {
  const {
    stripe,
    product,
    maxRetries = 6,
  } = params;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await stripe.products.update(product.id, {
        active: false,
      });
    } catch (error) {
      const statusCode = getStripeStatusCode(error);
      const isRateLimit = statusCode === 429;

      if (!isRateLimit || attempt === maxRetries) {
        throw error;
      }

      /*
       * 1秒、2秒、4秒、8秒……を基準に待機します。
       * 同時再試行を避けるため、少しランダム時間を加えます。
       */
      const baseDelay = 1000 * 2 ** attempt;
      const jitter = Math.floor(Math.random() * 500);
      const waitTime = baseDelay + jitter;

      console.warn(
        `Stripeレート制限: ${product.name}（${product.id}）を` +
          `${waitTime}ms後に再試行します。` +
          ` 試行 ${attempt + 1}/${maxRetries}`
      );

      await sleep(waitTime);
    }
  }

  throw new Error(
    `${product.name}のアーカイブに失敗しました。`
  );
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'reset APIは認識されています。',
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { targetEnv, confirmation } =
      schema.parse(body);

    const requiredConfirmation =
      targetEnv === 'live'
        ? '本番商品をリセット'
        : 'テスト商品をリセット';

    if (confirmation !== requiredConfirmation) {
      return NextResponse.json(
        {
          success: false,
          error: `確認文字列「${requiredConfirmation}」を正確に入力してください。`,
        },
        {
          status: 400,
        }
      );
    }

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

    /*
     * SDK側のネットワーク再試行も有効にします。
     *
     * ただし429については下の独自処理でも
     * 待機しながら再試行します。
     */
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-07-30.basil',
      maxNetworkRetries: 2,
      timeout: 30_000,
    });

    /*
     * 現在有効な商品だけを取得します。
     *
     * 前回の実行ですでにアーカイブ済みになった商品は
     * ここには含まれません。
     */
    const activeProducts: Stripe.Product[] = [];

    for await (const product of stripe.products.list({
      active: true,
      limit: 100,
    })) {
      activeProducts.push(product);
    }

    const archivedProductIds: string[] = [];
    const failedProducts: FailedProduct[] = [];

    /*
     * 並列処理は行いません。
     *
     * 1商品ずつ処理し、各リクエスト間にも待機を入れます。
     */
    for (let index = 0; index < activeProducts.length; index++) {
      const product = activeProducts[index];

      try {
        await archiveProductWithRetry({
          stripe,
          product,
          maxRetries: 6,
        });

        archivedProductIds.push(product.id);

        console.log(
          `Stripe商品アーカイブ: ${index + 1}/${activeProducts.length} ` +
            `${product.name}（${product.id}）`
        );
      } catch (error) {
        failedProducts.push({
          productId: product.id,
          name: product.name,
          error: getErrorMessage(error),
        });
      }

      /*
       * 成功・失敗にかかわらず次の更新まで待機します。
       * 500msなら最大約2リクエスト/秒です。
       */
      if (index < activeProducts.length - 1) {
        await sleep(500);
      }
    }

    /*
     * 1件でも失敗した場合は、
     * Supabaseの全削除を実行しません。
     */
    if (failedProducts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          targetEnv,
          stripeTargetCount: activeProducts.length,
          stripeArchivedCount: archivedProductIds.length,
          stripeFailedCount: failedProducts.length,
          supabaseDeleted: false,
          failedProducts,
          error:
            '一部のStripe商品のアーカイブに失敗したため、Supabaseのstripe_productsは削除していません。もう一度リセットを実行してください。',
        },
        {
          status: 500,
        }
      );
    }

    /*
     * この時点で、今回取得した全有効商品は
     * アーカイブ済みです。
     *
     * 念のため、まだ有効商品が残っていないか再確認します。
     */
    const remainingActiveProducts: Stripe.Product[] = [];

    for await (const product of stripe.products.list({
      active: true,
      limit: 100,
    })) {
      remainingActiveProducts.push(product);
    }

    if (remainingActiveProducts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          targetEnv,
          stripeArchivedCount: archivedProductIds.length,
          remainingActiveCount:
            remainingActiveProducts.length,
          supabaseDeleted: false,
          failedProducts: remainingActiveProducts.map(
            (product) => ({
              productId: product.id,
              name: product.name,
              error:
                'アーカイブ処理後も商品が有効な状態です。',
            })
          ),
          error:
            'Stripeに有効な商品が残っているため、Supabaseは削除していません。もう一度実行してください。',
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Stripeの有効商品が0件になった後で、
     * stripe_productsを全削除します。
     */
    const {
      error: deleteError,
      count: deletedCount,
    } = await supabase
      .from('stripe_products')
      .delete({
        count: 'exact',
      })
      .not('id', 'is', null);

    if (deleteError) {
      return NextResponse.json(
        {
          success: false,
          targetEnv,
          stripeArchivedCount:
            archivedProductIds.length,
          supabaseDeleted: false,
          error:
            `Stripe商品はアーカイブしましたが、` +
            `Supabaseのstripe_products削除に失敗しました: ${deleteError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      targetEnv,
      stripeTargetCount: activeProducts.length,
      stripeArchivedCount:
        archivedProductIds.length,
      supabaseDeletedCount: deletedCount ?? 0,
      message:
        `Stripeの残りの有効商品を${archivedProductIds.length}件アーカイブし、` +
        `Supabaseのstripe_productsを${deletedCount ?? 0}件削除しました。` +
        '続けて商品ファイルを「Supabase & Stripe」で再アップロードしてください。',
    });
  } catch (error) {
    console.error('商品リセットエラー:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'リクエスト内容が正しくありません。',
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
            : '商品リセットに失敗しました。',
      },
      {
        status: 500,
      }
    );
  }
}