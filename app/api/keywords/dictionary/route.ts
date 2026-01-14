// app/api/keywords/dictionary/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ 追加（POST）: answer + hiragana + romaji は必須、englishは任意
const postSchema = z.object({
  answer: z.string().min(1),
  inputHiragana: z.string().min(1),
  inputRomaji: z.string().min(1),
  inputEnglish: z.union([z.string().min(1), z.null()]).optional(),
});

// ✅ 削除（DELETE）
const deleteSchema = z.object({
  keywords: z.array(z.string().min(1)),
});

export async function POST(req: Request) {
  const body = postSchema.parse(await req.json());

  const payload = {
    answer: body.answer.trim(),
    inputHiragana: body.inputHiragana.trim(),
    inputRomaji: body.inputRomaji.trim(),
    inputEnglish:
      body.inputEnglish === undefined
        ? null
        : body.inputEnglish === null
        ? null
        : body.inputEnglish.trim() || null,
  };

  // ✅ 既に answer がある場合は更新、なければ追加（upsert）
  // ※ dictionaryテーブルで answer に unique が付いている前提
  const { error } = await supabase
    .from("dictionary")
    .upsert(payload, { onConflict: "answer" });

  if (error) {
    console.error("dictionary upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const body = deleteSchema.parse(await req.json());

  const { error } = await supabase
    .from("dictionary")
    .delete()
    .in("answer", body.keywords);

  if (error) {
    console.error("dictionary delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
