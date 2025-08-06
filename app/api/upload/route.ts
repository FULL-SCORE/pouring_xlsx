/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import formidable from "formidable";
import fs from "fs";
import * as XLSX from "xlsx";
import { parse } from "csv-parse/sync";
import { supabase } from "@/lib/supabase";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  const form = formidable({ keepExtensions: true });

  const buffer = await req.arrayBuffer();
  const fileData = Buffer.from(buffer);

  // 一時ファイルに保存
  const tmpFile = `/tmp/uploaded_file.xlsx`;
  fs.writeFileSync(tmpFile, fileData);

  let records: any[] = [];

  try {
    const workbook = XLSX.readFile(tmpFile);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    records = XLSX.utils.sheet_to_json(worksheet);

    let inserted = 0;
    for (const row of records) {
      const { error } = await supabase.from("video_info").insert([
        {
          vid: row.vid,
          title: row.title,
          cut: row.cut,
          // 他のフィールドも必要に応じて
        },
      ]);

      if (!error) inserted++;
    }

    return Response.json({ message: `${inserted} 件を挿入しました` });
  } catch (e) {
    console.error(e);
    return Response.json({ message: "ファイル処理中にエラー" }, { status: 500 });
  }
}
