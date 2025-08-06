// ✅ app/api/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const { items, updateTarget } = await req.json();
  const logs: string[] = [];

  for (const item of items) {
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
      _12K_ID,
      _8K_ID,
      _6K_ID,
      _4K_ID,
      EX_size,
      _12K_size,
      _8K_size,
      _6K_size,
      _4K_size,
      EX_price,
      _12K_price,
      _8K_price,
      _6K_price,
      _4K_price,
    } = item;

    // Supabase: video_info に upsert
    if (updateTarget === 'supabase' || updateTarget === 'both') {
        const { error: error1 } = await supabase
  .from('video_info')
  .upsert(
    [{
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
    }],
    {
      onConflict: 'vid', // ✅ string に修正！
    }
  );
      

      if (error1) {
        logs.push(`❌ Supabase登録失敗: video_info ${vid} (${error1.message})`);
      } else {
        logs.push(`✅ Supabase登録成功: video_info ${vid}`);
      }

      const { error: error2 } = await supabase.from('download_vid').upsert([
        {
          vid,
          EX_ID,
          '12K_ID': _12K_ID,
          '8K_ID': _8K_ID,
          '6K_ID': _6K_ID,
          '4K_ID': _4K_ID,
          EX_size,
          '12K_size': _12K_size,
          '8K_size': _8K_size,
          '6K_size': _6K_size,
          '4K_size': _4K_size,
        },
      ]);

      if (error2) {
        logs.push(`❌ Supabase登録失敗: download_vid ${vid} (${error2.message})`);
      } else {
        logs.push(`✅ Supabase登録成功: download_vid ${vid}`);
      }
    }

    // Stripe に登録
    if ((updateTarget === 'stripe' || updateTarget === 'both') && stripe) {
        try {
            const titleFormatted = `${title}（${cut ?? 'cutなし'}）_${vid}`;
            const day = new Date().toISOString().slice(0, 10);
          
            const products = await stripe.products.list({ limit: 100 });
            const existing = products.data.find(p => p.metadata?.vid === vid);
          
            const metadata: Record<string, string> = {
                vid,
                cut: cut ?? '',
                day,
              };
          
            let productId: string;
          
            if (existing) {
                await stripe.products.update(existing.id, {
                    name: titleFormatted,
                    metadata,
                  });
              productId = existing.id;
              logs.push(`🔁 Stripe更新成功: ${vid}`);
            } else {
              const created = await stripe.products.create({
                name: titleFormatted,
                metadata,
              });
              productId = created.id;
              logs.push(`✨ Stripe新規作成成功: ${productId}`);
            }
          
            // 価格登録（単位に注意: JPYの場合1円→100銭）
            const prices = [
              { key: 'EX_price', value: EX_price },
              { key: '12K_price', value: _12K_price },
              { key: '8K_price', value: _8K_price },
              { key: '6K_price', value: _6K_price },
              { key: '4K_price', value: _4K_price },
            ];
          
            for (const { key, value } of prices) {
                if (!value) continue;
              
                await stripe.prices.create({
                  product: productId,
                  unit_amount: Math.round(parseInt(value) / 100), // 価格を補正
                  currency: 'jpy',
                  nickname: key,
                });
                logs.push(`💰 Stripe価格追加: ${key}`);
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

  return NextResponse.json({ logs });
}
