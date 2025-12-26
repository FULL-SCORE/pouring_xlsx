"use client";

import { useEffect, useState } from "react";
import MissingKeywordList from "./MissingKeywordList";

type Missing = {
  keyword: string;
  used_count: number;
};

export default function DictionaryMissingSection() {
  const [items, setItems] = useState<Missing[]>([]);
  const [hiraganaMap, setHiraganaMap] = useState<Record<string, string>>({});
  const [alphabetMap, setAlphabetMap] = useState<Record<string, string>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  // 初期ロード
  useEffect(() => {
    fetch("/api/keywords/diff")
      .then(res => res.json())
      .then(data => {
        setItems(data.missing || []);
      });
  }, []);

  const addDictionary = async (keyword: string) => {
    const inputHiragana = hiraganaMap[keyword];
    const inputAlphabet = alphabetMap[keyword];

    if (!inputHiragana || !inputAlphabet) return;

    setLoadingKey(keyword);

    await fetch("/api/keywords/dictionary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer: keyword,
        inputHiragana,
        inputAlphabet,
      }),
    });

    setItems(prev => prev.filter(i => i.keyword !== keyword));
    setLoadingKey(null);
  };

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">
        ⚠ 未登録キーワード（映像には存在）
      </h2>

      <MissingKeywordList
        items={items}
        hiraganaMap={hiraganaMap}
        alphabetMap={alphabetMap}
        loadingKey={loadingKey}
        onChangeHiragana={(k, v) =>
          setHiraganaMap({ ...hiraganaMap, [k]: v })
        }
        onChangeAlphabet={(k, v) =>
          setAlphabetMap({ ...alphabetMap, [k]: v })
        }
        onAdd={addDictionary}
      />
    </section>
  );
}
