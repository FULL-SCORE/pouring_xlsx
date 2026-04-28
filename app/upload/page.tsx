'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';

type Service = 'supabase' | 'stripe' | 'both';
type TargetEnv = 'test' | 'live';

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [service, setService] = useState<Service>('both');
  const [targetEnv, setTargetEnv] = useState<TargetEnv>('test');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setAlert(null);
    setLogs([]);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setAlert({ type: 'error', message: 'ファイルを選択してください。' });
      return;
    }

    setIsUploading(true);
    setAlert(null);
    setLogs([]);

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const resultBuffer = event.target?.result;

        if (!resultBuffer) {
          throw new Error('ファイルの読み込み結果が空です。');
        }

        const data = new Uint8Array(resultBuffer as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheetName = workbook.SheetNames[0];

        if (!sheetName) {
          throw new Error('Excel内にシートが存在しません。');
        }

        const sheet = workbook.Sheets[sheetName];

        if (!sheet) {
          throw new Error('シートの取得に失敗しました。');
        }

        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
        });

        if (json.length === 0) {
          throw new Error('シート内にデータがありません。');
        }

        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            json,
            service,
            targetEnv,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || result?.message || 'APIエラーが発生しました。');
        }

        const combinedLogs = [
          ...(result.supabaseLogs || []),
          ...(result.stripeLogs || []),
        ];

        setLogs(combinedLogs);
        setAlert({
          type: 'success',
          message:
            targetEnv === 'live'
              ? '本番環境へのアップロードが完了しました。'
              : 'テスト環境へのアップロードが完了しました。',
        });
      } catch (error) {
        setAlert({
          type: 'error',
          message: `エラー発生: ${(error as Error).message}`,
        });
      } finally {
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      setAlert({
        type: 'error',
        message: 'ファイルの読み込みに失敗しました。',
      });
      setIsUploading(false);
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white font-sans flex items-center justify-center">
      <div>
        <h1 className="text-4xl font-extrabold text-center mb-10">
          データアップローダー
        </h1>

        <div className="max-w-xl mx-auto space-y-6 bg-gray-800/60 p-6 rounded-2xl shadow-xl">
          <div>
            <label className="block font-semibold mb-2">対象環境:</label>
            <select
              value={targetEnv}
              onChange={(e) => setTargetEnv(e.target.value as TargetEnv)}
              className={`w-full px-4 py-2 rounded-lg border focus:outline-none ${
                targetEnv === 'live'
                  ? 'bg-red-950 text-red-100 border-red-500'
                  : 'bg-gray-900 text-white border-gray-700'
              }`}
            >
              <option value="test">テスト環境</option>
              <option value="live">本番環境</option>
            </select>

            {targetEnv === 'live' && (
              <p className="mt-2 text-sm text-red-300 font-semibold">
                注意：本番のSupabaseとStripeに登録・更新されます。
              </p>
            )}
          </div>

          <div>
            <label className="block font-semibold mb-2">サービス選択:</label>
            <select
              value={service}
              onChange={(e) => setService(e.target.value as Service)}
              className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none"
            >
              <option value="both">Supabase & Stripe</option>
              <option value="supabase">Supabase のみ</option>
              <option value="stripe">Stripe のみ</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-2">
              ファイル選択 (.xlsx):
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={isUploading}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-700 hover:file:bg-blue-800 disabled:opacity-60"
            />

            {selectedFile && (
              <p className="mt-2 text-xs text-gray-400">
                選択中: {selectedFile.name}
              </p>
            )}
          </div>

          <div>
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className={`w-full text-white font-bold py-2 px-4 rounded-lg transition disabled:bg-gray-600 ${
                targetEnv === 'live'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isUploading
                ? 'アップロード中...'
                : targetEnv === 'live'
                  ? '本番環境へアップロード'
                  : 'テスト環境へアップロード'}
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
      </div>
    </main>
  );
}