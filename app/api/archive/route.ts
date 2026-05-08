import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const targetEnv = searchParams.get('targetEnv') === 'live' ? 'live' : 'test';

    const supabaseUrl =
      targetEnv === 'live'
        ? process.env.SUPABASE_URL_LIVE!
        : process.env.SUPABASE_URL_TEST!;

    const supabaseKey =
      targetEnv === 'live'
        ? process.env.SUPABASE_SERVICE_ROLE_KEY_LIVE!
        : process.env.SUPABASE_SERVICE_ROLE_KEY_TEST!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('stripe_products')
      .select('id, product_id, name, active, meta_vid, cut, day, created')
      .order('id', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      products: data ?? [],
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