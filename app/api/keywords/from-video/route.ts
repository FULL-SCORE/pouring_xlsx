import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL_LIVE!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_LIVE!
);

export async function GET() {
  const { data, error } = await supabase
    .rpc('get_video_keywords'); // ← SQL関数

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
