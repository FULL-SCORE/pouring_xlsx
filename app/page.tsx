'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [service, setService] = useState<'supabase' | 'stripe' | 'both'>('both');
  const [stripeEnv, setStripeEnv] = useState<'test' | 'live'>('test');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setAlert(null); // アラート初期化
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setAlert({ type: 'error', message: 'ファイルを選択してください。' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);

        setIsUploading(true);
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            json,
            service,
            stripeEnv,
          }),
        });

        const result = await response.json();
        const combinedLogs = [...(result.supabaseLogs || []), ...(result.stripeLogs || [])];
        setLogs(combinedLogs);

        setAlert({ type: 'success', message: 'アップロードが完了しました。' });
      } catch (error) {
        setAlert({
          type: 'error',
          message: `アップロード中にエラーが発生しました: ${(error as Error).message}`,
        });
      } finally {
        setIsUploading(false);
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  return (
    <main className="min-h-screen p-10 text-white bg-black">
      <h1 className="text-3xl font-bold mb-6">ファイルアップロード（トップページ）</h1>

      <div className="mb-4">
        <label className="block mb-2 font-bold">サービス選択:</label>
        <select
          className="text-white px-2 py-1 rounded"
          value={service}
          onChange={(e) =>
            setService(e.target.value as 'supabase' | 'stripe' | 'both')
          }
        >
          <option className='text-black' value="supabase">Supabase</option>
          <option className='text-black' value="stripe">Stripe</option>
          <option className='text-black' value="both">Supabase & Stripe</option>
        </select>
      </div>

      {(service === 'stripe' || service === 'both') && (
        <div className="mb-4">
          <label className="block mb-2 font-bold">Stripe環境:</label>
          <select
            className="text-white px-2 py-1 rounded"
            value={stripeEnv}
            onChange={(e) => setStripeEnv(e.target.value as 'test' | 'live')}
          >
            <option className='text-black' value="test">テスト</option>
            <option className='text-black' value="live">本番</option>
          </select>
        </div>
      )}

      <div className="mb-4">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="text-white"
        />
        {selectedFile && (
          <p className="mt-1 text-sm text-gray-300">選択されたファイル: {selectedFile.name}</p>
        )}
      </div>

      <div className="mb-6">
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          アップロード
        </button>
      </div>

      {alert && (
        <div
          className={`mb-6 p-3 rounded ${
            alert.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {alert.message}
        </div>
      )}

      {logs.length > 0 && (
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-bold mb-2">ログ:</h2>
          <ul className="text-sm space-y-1">
            {logs.map((log, i) => (
              <li key={i}>{log}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
