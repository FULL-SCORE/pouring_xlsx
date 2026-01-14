"use client";

import { useEffect, useState } from "react";

type DictItem = {
  answer: string;
  inputHiragana: string | null;
  inputRomaji: string | null;
  inputEnglish: string | null;
};

export default function SearchDictionary() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DictItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelected(new Set());
      return;
    }

    fetch(`/api/keywords/search?query=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => {
        setResults(Array.isArray(data) ? data : []);
        setSelected(new Set());
      });
  }, [query]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;

    const ok = window.confirm(`本当に削除しますか？\n\n${[...selected].join(", ")}`);
    if (!ok) return;

    setLoading(true);

    await fetch("/api/keywords/dictionary", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: Array.from(selected) }),
    });

    setResults((prev) => prev.filter((r) => !selected.has(r.answer)));
    setSelected(new Set());
    setLoading(false);
  };

  return (
    <section className="border rounded-md p-4 space-y-4">
      <h3 className="font-semibold">🔍 辞書キーワードを検索して削除</h3>

      <input
        type="text"
        placeholder="検索（answer / ひらがな / ローマ字 / 英語）"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="border px-3 py-2 rounded w-full"
      />

      {results.length > 0 && (
        <>
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0 || loading}
            className={`px-4 py-1 rounded text-sm text-white ${
              selected.size === 0 || loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            選択したキーワードを削除
          </button>

          <div className="border rounded divide-y">
            {results.map((r) => (
              <label
                key={r.answer}
                className="flex items-start gap-3 px-3 py-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(r.answer)}
                  onChange={() => toggle(r.answer)}
                />
                <div className="flex-1">
                  <div className="font-medium">{r.answer}</div>
                  <div className="text-xs text-neutral-600">
                    ひらがな: {r.inputHiragana ?? "-"} / ローマ字: {r.inputRomaji ?? "-"} / 英語: {r.inputEnglish ?? "-"}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </>
      )}

      {query && results.length === 0 && (
        <p className="text-sm text-neutral-500">該当するキーワードはありません</p>
      )}
    </section>
  );
}
