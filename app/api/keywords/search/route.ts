import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim();

  // クエリが空なら空配列
  if (!query) {
    return NextResponse.json([]);
  }

  // 🔴 まずは answer だけを見る（確実）
  const { data, error } = await supabase
    .from("dictionary")
    .select("answer")
    .ilike("answer", `%${query}%`)
    .order("answer", { ascending: true })
    .limit(30);

  if (error) {
    console.error("dictionary search error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
