// app/api/keywords/search/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim();

  if (!query) return NextResponse.json([]);

  // ✅ answer だけでなく、ひらがな/ローマ字/英語も検索対象にする
  // ✅ 返すのも4列
  const { data, error } = await supabase
    .from("dictionary")
    .select("answer,inputHiragana,inputRomaji,inputEnglish")
    .or(
      [
        `answer.ilike.%${query}%`,
        `inputHiragana.ilike.%${query}%`,
        `inputRomaji.ilike.%${query}%`,
        `inputEnglish.ilike.%${query}%`,
      ].join(",")
    )
    .order("answer", { ascending: true })
    .limit(50);

  if (error) {
    console.error("dictionary search error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
