"use client";

import { useState } from "react";

export default function AddDictionaryForm() {
  const [answer, setAnswer] = useState("");
  const [hiragana, setHiragana] = useState("");
  const [alphabet, setAlphabet] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit =
    answer.trim() && hiragana.trim() && alphabet.trim();

  const submit = async () => {
    if (!canSubmit) return;

    setLoading(true);

    await fetch("/api/keywords/dictionary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer,
        inputHiragana: hiragana,
        inputAlphabet: alphabet,
      }),
    });

    setAnswer("");
    setHiragana("");
    setAlphabet("");
    setLoading(false);
  };

  return (
    <section className="border rounded-md p-4 space-y-3">
      <h3 className="font-semibold">
        ➕ 辞書キーワードを追加
      </h3>

      <div className="flex gap-2">
        <input
          placeholder="キーワード（answer）"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="border px-2 py-1 rounded w-1/3"
        />
        <input
          placeholder="ひらがな"
          value={hiragana}
          onChange={(e) => setHiragana(e.target.value)}
          className="border px-2 py-1 rounded w-1/3"
        />
        <input
          placeholder="ローマ字"
          value={alphabet}
          onChange={(e) => setAlphabet(e.target.value)}
          className="border px-2 py-1 rounded w-1/3"
        />
      </div>

      <button
        disabled={!canSubmit || loading}
        onClick={submit}
        className={`px-4 py-1 rounded text-white ${
          !canSubmit || loading
            ? "bg-gray-400"
            : "bg-green-600 hover:bg-green-700"
        }`}
      >
        {loading ? "追加中…" : "追加"}
      </button>
    </section>
  );
}
