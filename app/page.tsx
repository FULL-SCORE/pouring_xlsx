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
      <a href='/upload' className='text-xl'>upload用ページURL</a>
    </div>
  )
}