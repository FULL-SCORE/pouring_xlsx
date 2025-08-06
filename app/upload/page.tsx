'use client';

import React, { useState } from 'react';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [updateTarget, setUpdateTarget] = useState<'supabase' | 'stripe' | 'both'>('both');
  const [status, setStatus] = useState<string | null>(null);

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

    const formData = new FormData();
    formData.append('file', file);
    formData.append('updateTarget', updateTarget);

    setStatus('⏳ アップロード中...');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      setStatus(json.message || '✅ 完了しました');
    } catch (error) {
      setStatus('❌ エラーが発生しました');
      console.error(error);
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
    </div>
  );
}
