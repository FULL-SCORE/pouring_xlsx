/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest } from "next/server";
import formidable from "formidable";
import fs from "fs";
import * as XLSX from "xlsx";
import { parse } from "csv-parse/sync";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic"; // 静的キャッシュ無効

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return new Response("ファイルが見つかりません", { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const ext = file.name.split(".").pop()?.toLowerCase();
  let records: any[] = [];

  try {
    if (ext === "csv") {
      records = parse(buffer.toString("utf8"), {
        columns: true,
        skip_empty_lines: true,
      });
    } else if (ext === "xlsx") {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      records = XLSX.utils.sheet_to_json(worksheet);
    } else {
      return new Response("対応していないファイル形式", { status: 400 });
    }

    let success = 0;
    let failed = 0;

    for (const row of records) {
      try {
        const vid = row["vid"];
        const cut = row["cut"];
        const resolutionJson = safeJsonParse(row["resolution"]);
        const metadataJson = safeJsonParse(row["metadata"]);

        const videoInfoData = {
          vid,
          cut,
          title: `${row["title"]}${cut}`,
          detail: row["detail"],
          dulation: row["dulation"],
          resolution: resolutionJson,
          keyword: row["keyword"],
          framerate: row["framerate"],
          format: row["format"],
          metadata: metadataJson,
          footageServer: row["footageServer"],
          DF: row["DF"],
          push: toBoolean(row["push"]),
        };
        

        const { error: viErr } = await supabase.from("video_info").upsert([videoInfoData], {
          onConflict: "vid",  // ← ここは string でOK
        });

        if (viErr) throw new Error(`video_info error: ${viErr.message}`);

        const downloadVidData = {
          vid,
          EX_ID: toInt(row["EX_ID"]),
          "12K_ID": toInt(row["12K_ID"]),
          "8K_ID": toInt(row["8K_ID"]),
          "6K_ID": toInt(row["6K_ID"]),
          "4K_ID": toInt(row["4K_ID"]),
          EX_size: row["EX_size"] || null,
          "12K_size": row["12K_size"] || null,
          "8K_size": row["8K_size"] || null,
          "6K_size": row["6K_size"] || null,
          "4K_size": row["4K_size"] || null,
        };

        const nonEmpty = Object.values(downloadVidData).some(
          (val) => val !== null && val !== undefined && val !== ""
        );

        if (nonEmpty) {
          const { error: dvErr } = await supabase.from("video_info").upsert([videoInfoData], {
            onConflict: "vid",  // ← ここは string でOK
          });
          if (dvErr) throw new Error(`download_vid error: ${dvErr.message}`);
        }

        console.log(`✅ 登録成功: ${vid}`);
        success++;
      } catch (e: any) {
        console.error(`❌ 登録失敗: ${row.vid} - ${e.message}`);
        failed++;
      }
    }

    return Response.json({
      message: `✅ 登録成功: ${success} 件, ❌ 失敗: ${failed} 件`,
    });
  } catch (e) {
    console.error("解析中にエラー:", e);
    return new Response("処理中にエラーが発生しました", { status: 500 });
  }
}

// 補助関数
function safeJsonParse(input: any) {
  if (!input) return {};
  try {
    return typeof input === "object" ? input : JSON.parse(input.replace(/“|”/g, '"'));
  } catch {
    return {};
  }
}
function toBoolean(val: any): boolean {
  return String(val).trim().toLowerCase() === "true";
}
function toInt(val: any): number | null {
  const n = parseInt(val);
  return isNaN(n) ? null : n;
}
