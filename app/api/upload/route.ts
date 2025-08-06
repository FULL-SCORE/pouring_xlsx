import { NextRequest, NextResponse } from 'next/server';
import formidable, { Fields, Files } from 'formidable';
import { parse } from 'papaparse';
import type { IncomingMessage } from 'http';

// Supabase & Stripe client
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseForm(req: NextRequest): Promise<{ fields: Fields; files: Files }> {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: false });
    form.parse(req as unknown as IncomingMessage, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

interface Item {
  vid: string;
  title: string;
  price: number;
}

async function updateSupabase(items: Item[]) {
  console.log('🔥 Supabase 処理中...');
  for (const item of items) {
    console.log(`➡️ Upserting Supabase: ${item.vid} - ${item.title}`);
    const { error } = await supabase.from('video_info').upsert(item);
    if (error) {
      console.error('❌ Supabaseエラー:', error);
    }
  }
  console.log('✅ Supabase 完了');
}

async function updateStripe(items: Item[]) {
  console.log('⚙️ Stripe 処理中...');
  for (const item of items) {
    console.log(`➡️ Stripe product 検索中: ${item.vid}`);
    const products = await stripe.products.list({ limit: 100 });
    const foundProduct = products.data.find(
      (p) => p.metadata?.vid === item.vid
    );

    if (foundProduct) {
      console.log(`🔄 既存商品更新: ${foundProduct.id}`);
      await stripe.products.update(foundProduct.id, {
        name: item.title,
        metadata: {
          vid: item.vid,
        },
      });
    } else {
      console.log(`➕ 新規商品作成: ${item.vid}`);
      await stripe.products.create({
        name: item.title,
        metadata: {
          vid: item.vid,
        },
      });
    }
  }
  console.log('✅ Stripe 完了');
}

export async function POST(req: NextRequest) {
  try {
    console.log('📦 アップロード開始');
    const formData = await req.formData();
    const mode = formData.get('mode');
    const file = formData.get('file') as File;

    if (!file) {
      console.error('❌ ファイルが見つかりません');
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const xlsx = await import('xlsx');
    const wb = xlsx.read(buffer);
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const csv = xlsx.utils.sheet_to_csv(sheet);

    const parsed = parse(csv, { header: true });
    console.log('📝 CSVパース完了');

    if (!parsed.data || !Array.isArray(parsed.data)) {
      console.error('❌ データパースに失敗');
      return NextResponse.json({ error: 'データパースに失敗しました' }, { status: 400 });
    }

    const items: Item[] = [];
    for (const row of parsed.data) {
      if (typeof row !== 'object' || row === null) continue;
      items.push({
        vid: String((row as Record<string, unknown>)['vid'] ?? ''),
        title: String((row as Record<string, unknown>)['title'] ?? ''),
        price: Number((row as Record<string, unknown>)['price'] ?? 0),
      });
    }

    console.log('🧾 パース結果:', items);
    console.log('🛠 処理モード:', mode);

    if (mode === 'supabase') {
      console.log('📤 Supabase更新開始');
      await updateSupabase(items);
    } else if (mode === 'stripe') {
      console.log('💳 Stripe更新開始');
      await updateStripe(items);
    } else if (mode === 'both') {
      console.log('📤 Supabaseと💳 Stripeの両方を更新');
      await updateSupabase(items);
      await updateStripe(items);
    } else {
      console.warn('⚠️ 未定義のmode:', mode);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ アップロード失敗:', error);
    return NextResponse.json({ error: 'アップロードエラー' }, { status: 500 });
  }
}
