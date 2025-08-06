import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'papaparse';
import { read, utils } from 'xlsx';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file || !file.arrayBuffer) {
      return NextResponse.json({ error: 'ファイルが不正です' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = read(buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const csv = utils.sheet_to_csv(worksheet);

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
