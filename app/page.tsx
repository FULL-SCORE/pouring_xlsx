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
    setAlert(null);
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
          body: JSON.stringify({ json, service, stripeEnv }),
        });

        const result = await response.json();
        const combinedLogs = [...(result.supabaseLogs || []), ...(result.stripeLogs || [])];
        setLogs(combinedLogs);
        setAlert({ type: 'success', message: 'アップロードが完了しました。' });
      } catch (error) {
        setAlert({
          type: 'error',
          message: `エラー発生: ${(error as Error).message}`,
        });
      } finally {
        setIsUploading(false);
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white p-10 font-sans">
      <h1 className="text-4xl font-extrabold text-center mb-10">データアップローダー</h1>

      <div className="max-w-xl mx-auto space-y-6 bg-gray-800/60 p-6 rounded-2xl shadow-xl">
        <div>
          <label className="block font-semibold mb-2">サービス選択:</label>
          <select
            value={service}
            onChange={(e) => setService(e.target.value as 'supabase' | 'stripe' | 'both')}
            className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none"
          >
            <option value="supabase">Supabase のみ</option>
            <option value="stripe">Stripe のみ</option>
            <option value="both">Supabase & Stripe</option>
          </select>
        </div>

        {(service === 'stripe' || service === 'both') && (
          <div>
            <label className="block font-semibold mb-2">Stripe 環境:</label>
            <select
              value={stripeEnv}
              onChange={(e) => setStripeEnv(e.target.value as 'test' | 'live')}
              className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none"
            >
              <option value="test">テスト環境</option>
              <option value="live">本番環境</option>
            </select>
          </div>
        )}

        <div>
          <label className="block font-semibold mb-2">ファイル選択 (.xlsx):</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-700 hover:file:bg-blue-800"
          />
          {selectedFile && (
            <p className="mt-2 text-xs text-gray-400">選択中: {selectedFile.name}</p>
          )}
        </div>

        <div>
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition"
          >
            {isUploading ? 'アップロード中...' : 'アップロード開始'}
          </button>
        </div>

        {alert && (
          <div
            className={`p-4 rounded-lg text-sm animate-fade-in ${
              alert.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {alert.message}
          </div>
        )}

        {logs.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
            <h2 className="text-lg font-bold mb-2">ログ:</h2>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
              {logs.map((log, i) => (
                <li key={i}>{log}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
