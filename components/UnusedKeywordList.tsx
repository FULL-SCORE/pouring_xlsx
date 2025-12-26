"use client";

type Props = {
  keywords: string[];
  selected: Set<string>;
  onToggle: (keyword: string) => void;
};

export default function UnusedKeywordList({
  keywords,
  selected,
  onToggle,
}: Props) {
  if (keywords.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        未使用キーワードはありません
      </p>
    );
  }

  return (
    <div className="border rounded-md divide-y">
      {keywords.map((keyword) => (
        <label
          key={keyword}
          className="flex items-center gap-3 px-4 py-2 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selected.has(keyword)}
            onChange={() => onToggle(keyword)}
          />
          <span>{keyword}</span>
          <span className="ml-auto text-xs text-neutral-400">
            映像未使用
          </span>
        </label>
      ))}
    </div>
  );
}
