import { NextRequest, NextResponse } from 'next/server';
import formidable from 'formidable';
import { parse } from 'papaparse';
import type { IncomingMessage } from 'http';

interface RowData {
  vid?: string;
  title?: string;
  price?: number | string;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

async function parseForm(req: NextRequest) {
  const form = formidable({ multiples: false });

  return new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
    form.parse(req as unknown as IncomingMessage, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { fields, files } = await parseForm(req);
    const updateTarget = fields.updateTarget?.[0] ?? 'both';
    const file = files.file?.[0];

    if (!file || !file.filepath) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 });
    }

    const fs = await import('fs/promises');
    const buffer = await fs.readFile(file.filepath);

    const xlsx = await import('xlsx');
    const wb = xlsx.read(buffer);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const csv = xlsx.utils.sheet_to_csv(sheet);

    const parsed = parse(csv, { header: true });

    const items = (parsed.data as RowData[])
  .map((row) => ({
    vid: String(row.vid ?? ''),
    title: String(row.title ?? ''),
    price: Number(row.price ?? 0),
  }))
      .filter((item) => item.vid && item.title);

    const baseURL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseURL}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, updateTarget }),
    });

    const json = await res.json();
    return NextResponse.json(json);
  } catch (error) {
    console.error('❌ アップロード失敗:', error);
    return NextResponse.json({ error: 'アップロードエラー' }, { status: 500 });
  }
}
