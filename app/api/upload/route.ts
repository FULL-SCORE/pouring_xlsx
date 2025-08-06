import { NextRequest, NextResponse } from 'next/server';
import formidable, { Fields, Files } from 'formidable';
import { parse } from 'papaparse';
import type { IncomingMessage } from 'http';

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

export async function POST(req: NextRequest) {
  try {
    const { files } = await parseForm(req);
    const file = files.file?.[0];

    if (!file || !file.filepath) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 });
    }

    const fs = await import('fs/promises');
    const buffer: Buffer = await fs.readFile(file.filepath);

    // XLSXパース処理（バッファ→CSV文字列→パース）
    const xlsx = await import('xlsx');
    const wb = xlsx.read(buffer);
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const csv = xlsx.utils.sheet_to_csv(sheet);

    // CSV文字列をパース
    const parsed = parse(csv, { header: true });

    if (!parsed.data || !Array.isArray(parsed.data)) {
      return NextResponse.json({ error: 'データパースに失敗しました' }, { status: 400 });
    }

    const items: {
      vid: string;
      title: string;
      price: number;
    }[] = [];

    for (const row of parsed.data) {
      if (typeof row !== 'object' || row === null) continue;

      items.push({
        vid: String((row as Record<string, unknown>)['vid'] ?? ''),
        title: String((row as Record<string, unknown>)['title'] ?? ''),
        price: Number((row as Record<string, unknown>)['price'] ?? 0),
      });
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error('❌ アップロード失敗:', error);
    return NextResponse.json({ error: 'アップロードエラー' }, { status: 500 });
  }
}
