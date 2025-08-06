/* eslint-disable @typescript-eslint/no-explicit-any */

"use client"

import { useState } from 'react'
import axios from 'axios'

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'stripe' | 'supabase' | 'start'>('start')

  const handleUpload = async () => {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('mode', mode)

    try {
      const res = await axios.post('/api/upload', formData)
      setMessage(res.data.message)
    } catch (err: any) {
      setMessage(`エラー: ${err.message}`)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-xl mb-4">Excel/CSV アップロード</h1>
      <input type="file" accept=".xlsx,.csv" onChange={e => setFile(e.target.files?.[0] ?? null)} />

      <div className="my-4">
        <label className="mr-2">処理モード：</label>
        <select value={mode} onChange={e => setMode(e.target.value as any)}>
          <option value="start">start（両方）</option>
          <option value="stripe">stripe</option>
          <option value="supabase">supabase</option>
        </select>
      </div>

      <button className="mt-4 px-4 py-2 bg-blue-500 text-white" onClick={handleUpload}>
        アップロードして処理
      </button>

      <p className="mt-4 text-green-600">{message}</p>
    </div>
  )
}