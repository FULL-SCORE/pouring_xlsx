import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const deleteSchema = z.object({
  keywords: z.array(z.string().min(1)),
});

export async function DELETE(req: Request) {
  const body = deleteSchema.parse(await req.json());

  const { error } = await supabase
    .from("dictionary")
    .delete()
    .in("answer", body.keywords);

  if (error) {
    console.error("dictionary delete error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
