'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

export default function UploadPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [service, setService] = useState<'supabase' | 'stripe' | 'both'>('both');
  const [stripeEnv, setStripeEnv] = useState<'test' | 'live'>('test');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json, service, stripeEnv }),
    });

    const result = await response.json();
    setLogs([...(result.supabaseLogs || []), ...(result.stripeLogs || [])]);
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Excel アップロード</h1>

      <div className="mb-4">
        <label className="block mb-2 font-semibold">処理対象サービス:</label>
        <select
          value={service}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
            setStripeEnv(e.target.value as 'test' | 'live')}          
          className="border p-2 w-full"
        >
          <option value="both">Supabase + Stripe</option>
          <option value="supabase">Supabaseのみ</option>
          <option value="stripe">Stripeのみ</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-semibold">Stripe 環境:</label>
        <select
          value={stripeEnv}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
            setStripeEnv(e.target.value as 'test' | 'live')}          
          className="border p-2 w-full"
        >
          <option value="test">テスト</option>
          <option value="live">本番</option>
        </select>
      </div>

      <input type="file" accept=".xlsx" onChange={handleFileUpload} className="mb-4" />

      <div>
        <h2 className="font-semibold mb-2">ログ出力:</h2>
        <pre className="bg-gray-100 p-4 max-h-96 overflow-y-scroll whitespace-pre-wrap">
          {logs.join('\n')}
        </pre>
      </div>
    </div>
  );
}
