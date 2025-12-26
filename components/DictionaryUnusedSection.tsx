"use client";

import { useEffect, useState } from "react";
import UnusedKeywordList from "./UnusedKeywordList";
import DeleteUnusedKeywords from "./DeleteUnusedKeywords";

export default function DictionaryUnusedSection() {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // 初期ロード
  useEffect(() => {
    fetch("/api/keywords/diff")
      .then(res => res.json())
      .then(data => {
        setKeywords(
          (data.unused || []).map((u: { keyword: string }) => u.keyword)
        );
      });
  }, []);

  // 個別選択
  const toggleSelect = (keyword: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(keyword) ? next.delete(keyword) : next.add(keyword);
      return next;
    });
  };

  // 全選択 / 全解除
  const toggleAll = () => {
    if (selected.size === keywords.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(keywords));
    }
  };

  // 削除処理
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

    setKeywords(prev => prev.filter(k => !selected.has(k)));
    setSelected(new Set());
    setLoading(false);
  };

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">
        🗑 未使用キーワード（dictionaryのみ）
      </h2>

      <DeleteUnusedKeywords
        allKeywords={keywords}
        selected={selected}
        onToggleAll={toggleAll}
        onDelete={deleteSelected}
        loading={loading}
      />

      <UnusedKeywordList
        keywords={keywords}
        selected={selected}
        onToggle={toggleSelect}
      />
    </section>
  );
}
