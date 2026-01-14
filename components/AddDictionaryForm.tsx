"use client";

import { useState } from "react";

export default function AddDictionaryForm() {
  const [answer, setAnswer] = useState("");
  const [hiragana, setHiragana] = useState("");
  const [romaji, setRomaji] = useState("");
  const [english, setEnglish] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = answer.trim() && hiragana.trim() && romaji.trim();

  const submit = async () => {
    if (!canSubmit) return;

    setLoading(true);

    await fetch("/api/keywords/dictionary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer: answer.trim(),
        inputHiragana: hiragana.trim(),
        inputRomaji: romaji.trim(),
        inputEnglish: english.trim() ? english.trim() : null,
      }),
    });

    setAnswer("");
    setHiragana("");
    setRomaji("");
    setEnglish("");
    setLoading(false);
  };

  return (
    <section className="border rounded-md p-4 space-y-3">
      <h3 className="font-semibold">➕ 辞書キーワードを追加</h3>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            placeholder="キーワード（answer）"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="border px-2 py-1 rounded w-1/3"
          />
          <input
            placeholder="ひらがな（inputHiragana）"
            value={hiragana}
            onChange={(e) => setHiragana(e.target.value)}
            className="border px-2 py-1 rounded w-1/3"
          />
          <input
            placeholder="ローマ字（inputRomaji）"
            value={romaji}
            onChange={(e) => setRomaji(e.target.value)}
            className="border px-2 py-1 rounded w-1/3"
          />
        </div>

        <input
          placeholder="英語（inputEnglish） ※任意"
          value={english}
          onChange={(e) => setEnglish(e.target.value)}
          className="border px-2 py-1 rounded w-full"
        />
      </div>

      <button
        disabled={!canSubmit || loading}
        onClick={submit}
        className={`px-4 py-1 rounded text-white ${
          !canSubmit || loading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
        }`}
      >
        {loading ? "追加中…" : "追加"}
      </button>
    </section>
  );
}
