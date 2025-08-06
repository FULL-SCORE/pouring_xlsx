'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [updateTarget, setUpdateTarget] = useState<'supabase' | 'stripe' | 'both'>('both');
  const [status, setStatus] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]); // ← ログ表示用

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setStatus('⚠ ファイルを選択してください。');
      return;
    }

    setStatus('⏳ ファイルを解析中...');
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    const payload = {
      items: jsonData,
      updateTarget,
    };

    setStatus('⏳ アップロード中...');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.logs) {
        setLogs(result.logs);
        setStatus('✅ 完了しました');
      } else {
        setStatus(result.message || '⚠️ エラーが発生しました');
      }
    } catch (err) {
      console.error(err);
      setStatus('❌ 通信エラー');
    }
  };

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      <h1>CSV/Excel アップロード</h1>
      <input type="file" accept=".csv,.xlsx" onChange={handleFileChange} />

      <div style={{ margin: '1rem 0' }}>
        <label>
          <input
            type="radio"
            value="supabase"
            checked={updateTarget === 'supabase'}
            onChange={() => setUpdateTarget('supabase')}
          />
          Supabase のみ
        </label>
        <label style={{ marginLeft: '1rem' }}>
          <input
            type="radio"
            value="stripe"
            checked={updateTarget === 'stripe'}
            onChange={() => setUpdateTarget('stripe')}
          />
          Stripe のみ
        </label>
        <label style={{ marginLeft: '1rem' }}>
          <input
            type="radio"
            value="both"
            checked={updateTarget === 'both'}
            onChange={() => setUpdateTarget('both')}
          />
          両方
        </label>
      </div>

      <button onClick={handleSubmit} style={{ padding: '0.5rem 1rem' }}>
        アップロード
      </button>

      {status && <p style={{ marginTop: '1rem' }}>{status}</p>}

      {/* ログ表示 */}
      {logs.length > 0 && (
        <div style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      )}
    </div>
  );
}
