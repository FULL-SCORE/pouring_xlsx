import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data: missing, error: e1 } =
    await supabase.rpc('get_missing_dictionary_keywords');

  const { data: unused, error: e2 } =
    await supabase.rpc('get_unused_dictionary_keywords');

  if (e1 || e2) {
    return NextResponse.json(
      { error: e1?.message || e2?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ missing, unused });
}
