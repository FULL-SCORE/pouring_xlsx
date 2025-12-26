"use client";

import { useEffect, useState } from "react";

type DictItem = {
  answer: string;
};

export default function SearchDictionary() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DictItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // 検索
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

  // 個別選択
  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // 削除
  const deleteSelected = async () => {
    if (selected.size === 0) return;

    const ok = window.confirm(
      `本当に削除しますか？\n\n${[...selected].join(", ")}`
    );
    if (!ok) return;

    setLoading(true);

    await fetch("/api/keywords/dictionary", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords: Array.from(selected),
      }),
    });

    // UI 更新
    setResults((prev) =>
      prev.filter((r) => !selected.has(r.answer))
    );
    setSelected(new Set());
    setLoading(false);
  };

  return (
    <section className="border rounded-md p-4 space-y-4">
      <h3 className="font-semibold">
        🔍 辞書キーワードを検索して削除
      </h3>

      <input
        type="text"
        placeholder="削除したいキーワードを入力"
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
            {results.map(({ answer }) => (
              <label
                key={answer}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(answer)}
                  onChange={() => toggle(answer)}
                />
                <span>{answer}</span>
              </label>
            ))}
          </div>
        </>
      )}

      {query && results.length === 0 && (
        <p className="text-sm text-neutral-500">
          該当するキーワードはありません
        </p>
      )}
    </section>
  );
}
