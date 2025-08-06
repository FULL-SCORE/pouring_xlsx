'use client';

import React, { useState } from 'react';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [updateTarget, setUpdateTarget] = useState<'supabase' | 'stripe' | 'both'>('both');
  const [logs, setLogs] = useState<string[]>([]);

  const handleSubmit = async () => {
    if (!file) {
      setLogs(['⚠ ファイルを選択してください']);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('updateTarget', updateTarget);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      setLogs(json.logs || [json.error || '✅ 完了しました']);
    } catch (error) {
      console.error(error);
      setLogs(['❌ エラーが発生しました']);
    }
  };

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      <h1>CSV/Excel アップロード</h1>
      <input type="file" accept=".csv,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

      <div style={{ margin: '1rem 0' }}>
        <label>
          <input type="radio" value="supabase" checked={updateTarget === 'supabase'} onChange={() => setUpdateTarget('supabase')} />
          Supabase のみ
        </label>
        <label style={{ marginLeft: '1rem' }}>
          <input type="radio" value="stripe" checked={updateTarget === 'stripe'} onChange={() => setUpdateTarget('stripe')} />
          Stripe のみ
        </label>
        <label style={{ marginLeft: '1rem' }}>
          <input type="radio" value="both" checked={updateTarget === 'both'} onChange={() => setUpdateTarget('both')} />
          両方
        </label>
      </div>

      <button onClick={handleSubmit} style={{ padding: '0.5rem 1rem' }}>アップロード</button>

      {logs.length > 0 && (
        <div style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>
          {logs.map((log, i) => (
            <p key={i}>{log}</p>
          ))}
        </div>
      )}
    </div>
  );
}
