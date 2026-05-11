'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';

type Service = 'supabase' | 'stripe' | 'both';
type TargetEnv = 'test' | 'live';

type UploadLog = {
  fileName: string;
  status: 'success' | 'error';
  logs: string[];
  error?: string;
};

export default function Home() {
  const [logs, setLogs] = useState<UploadLog[]>([]);
  const [service, setService] = useState<Service>('both');
  const [targetEnv, setTargetEnv] = useState<TargetEnv>('test');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
  });
  const [alert, setAlert] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    setSelectedFiles(files);
    setAlert(null);
    setLogs([]);
    setCurrentFileName('');
    setProgress({
      current: 0,
      total: files.length,
    });
  };

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const result = event.target?.result;

        if (!result) {
          reject(new Error('ファイルの読み込み結果が空です。'));
          return;
        }

        resolve(result as ArrayBuffer);
      };

      reader.onerror = () => {
        reject(new Error('ファイルの読み込みに失敗しました。'));
      };

      reader.readAsArrayBuffer(file);
    });
  };

  const parseFileToJson = async (file: File): Promise<Record<string, unknown>[]> => {
    const buffer = await readFileAsArrayBuffer(file);
    const data = new Uint8Array(buffer);

    const isCsv = file.name.toLowerCase().endsWith('.csv');

    const workbook = XLSX.read(data, {
      type: 'array',
      raw: false,
      codepage: isCsv ? 65001 : undefined,
    });

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw new Error('ファイル内にシートが存在しません。');
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

    return json;
  };

  const uploadOneFile = async (file: File): Promise<UploadLog> => {
    try {
      const json = await parseFileToJson(file);

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json,
          service,
          targetEnv,
          fileName: file.name,
        }),
      });

      const contentType = response.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        const text = await response.text();

        throw new Error(
          `APIからJSON以外のレスポンスが返りました。認証ページやHTMLが返っている可能性があります。先頭: ${text.slice(
            0,
            100
          )}`
        );
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || result?.message || 'APIエラーが発生しました。'
        );
      }

      const combinedLogs = [
        ...(result.supabaseLogs || []),
        ...(result.stripeLogs || []),
      ];

      return {
        fileName: file.name,
        status: 'success',
        logs:
          combinedLogs.length > 0
            ? combinedLogs
            : ['アップロードが完了しました。'],
      };
    } catch (error) {
      return {
        fileName: file.name,
        status: 'error',
        logs: [],
        error: (error as Error).message,
      };
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setAlert({
        type: 'error',
        message: 'ファイルを選択してください。',
      });
      return;
    }

    if (targetEnv === 'live') {
      const confirmed = window.confirm(
        `本番環境に ${selectedFiles.length} 件のファイルをアップロードします。\n本当に実行しますか？`
      );

      if (!confirmed) {
        return;
      }
    }

    setIsUploading(true);
    setAlert(null);
    setLogs([]);
    setProgress({
      current: 0,
      total: selectedFiles.length,
    });

    const results: UploadLog[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];

      setCurrentFileName(file.name);
      setProgress({
        current: i + 1,
        total: selectedFiles.length,
      });

      const result = await uploadOneFile(file);
      results.push(result);

      setLogs([...results]);
    }

    const successCount = results.filter((item) => item.status === 'success').length;
    const errorCount = results.filter((item) => item.status === 'error').length;

    if (errorCount > 0) {
      setAlert({
        type: 'error',
        message: `${successCount}件成功、${errorCount}件失敗しました。ログを確認してください。`,
      });
    } else {
      setAlert({
        type: 'success',
        message:
          targetEnv === 'live'
            ? `${successCount}件の本番環境へのアップロードが完了しました。`
            : `${successCount}件のテスト環境へのアップロードが完了しました。`,
      });
    }

    setCurrentFileName('');
    setIsUploading(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white font-sans flex items-center justify-center px-4 py-10">
      <div className="w-full">
        <h1 className="text-4xl font-extrabold text-center mb-10">
          データアップローダー
        </h1>

        <div className="max-w-3xl mx-auto space-y-6 bg-gray-800/60 p-6 rounded-2xl shadow-xl">
          <div>
            <label className="block font-semibold mb-2">対象環境:</label>

            <select
              value={targetEnv}
              onChange={(e) => setTargetEnv(e.target.value as TargetEnv)}
              disabled={isUploading}
              className={`w-full px-4 py-2 rounded-lg border focus:outline-none disabled:opacity-60 ${
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
              disabled={isUploading}
              className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none disabled:opacity-60"
            >
              <option value="both">Supabase & Stripe</option>
              <option value="supabase">Supabase のみ</option>
              <option value="stripe">Stripe のみ</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-2">
              ファイル選択 (.xlsx / .xls / .csv)
            </label>

            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              multiple
              onChange={handleFileChange}
              disabled={isUploading}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-700 hover:file:bg-blue-800 disabled:opacity-60"
            />

            {selectedFiles.length > 0 && (
              <div className="mt-3 bg-gray-900/70 border border-gray-700 rounded-lg p-3">
                <p className="text-sm font-semibold mb-2">
                  選択中: {selectedFiles.length}件
                </p>

                <ul className="space-y-1 text-xs text-gray-300 max-h-32 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <li key={`${file.name}-${index}`}>
                      {index + 1}. {file.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {isUploading && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <p className="text-sm font-semibold">
                アップロード中: {progress.current} / {progress.total}
              </p>

              {currentFileName && (
                <p className="mt-1 text-xs text-gray-400">
                  処理中: {currentFileName}
                </p>
              )}

              <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{
                    width:
                      progress.total > 0
                        ? `${(progress.current / progress.total) * 100}%`
                        : '0%',
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className={`w-full text-white font-bold py-2 px-4 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed ${
                targetEnv === 'live'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isUploading
                ? 'アップロード中...'
                : targetEnv === 'live'
                  ? '本番環境へまとめてアップロード'
                  : 'テスト環境へまとめてアップロード'}
            </button>
          </div>

          {alert && (
            <div
              className={`p-4 rounded-lg text-sm ${
                alert.type === 'success' ? 'bg-green-600' : 'bg-red-600'
              }`}
            >
              {alert.message}
            </div>
          )}

          {logs.length > 0 && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
              <h2 className="text-lg font-bold mb-3">アップロードログ:</h2>

              <div className="space-y-4">
                {logs.map((item, index) => (
                  <div
                    key={`${item.fileName}-${index}`}
                    className={`border rounded-lg p-3 ${
                      item.status === 'success'
                        ? 'border-green-700 bg-green-950/30'
                        : 'border-red-700 bg-red-950/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-bold text-sm">{item.fileName}</h3>

                      <span
                        className={`text-xs font-bold ${
                          item.status === 'success'
                            ? 'text-green-300'
                            : 'text-red-300'
                        }`}
                      >
                        {item.status === 'success' ? '成功' : '失敗'}
                      </span>
                    </div>

                    {item.error && (
                      <p className="mt-2 text-sm text-red-300">
                        {item.error}
                      </p>
                    )}

                    {item.logs.length > 0 && (
                      <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-gray-300">
                        {item.logs.map((log, logIndex) => (
                          <li key={logIndex}>{log}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}