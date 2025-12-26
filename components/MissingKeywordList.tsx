"use client";

import MissingKeywordItem from "./MissingKeywordItem";

type Missing = {
  keyword: string;
  used_count: number;
};

type Props = {
  items: Missing[];
  hiraganaMap: Record<string, string>;
  alphabetMap: Record<string, string>;
  loadingKey: string | null;
  onChangeHiragana: (key: string, value: string) => void;
  onChangeAlphabet: (key: string, value: string) => void;
  onAdd: (key: string) => void;
};

export default function MissingKeywordList({
  items,
  hiraganaMap,
  alphabetMap,
  loadingKey,
  onChangeHiragana,
  onChangeAlphabet,
  onAdd,
}: Props) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        未登録キーワードはありません
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map(({ keyword, used_count }) => (
        <MissingKeywordItem
          key={keyword}
          keyword={keyword}
          usedCount={used_count}
          hiragana={hiraganaMap[keyword] || ""}
          alphabet={alphabetMap[keyword] || ""}
          loading={loadingKey === keyword}
          onChangeHiragana={(v) =>
            onChangeHiragana(keyword, v)
          }
          onChangeAlphabet={(v) =>
            onChangeAlphabet(keyword, v)
          }
          onAdd={() => onAdd(keyword)}
        />
      ))}
    </div>
  );
}
