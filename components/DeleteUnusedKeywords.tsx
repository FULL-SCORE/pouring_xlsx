"use client";

type Props = {
  allKeywords: string[];
  selected: Set<string>;
  onToggleAll: () => void;
  onDelete: () => void;
  loading: boolean;
};

export default function DeleteUnusedKeywords({
  allKeywords,
  selected,
  onToggleAll,
  onDelete,
  loading,
}: Props) {
  return (
    <div className="flex items-center gap-4 mb-3">
      <button
        onClick={onToggleAll}
        className="text-sm underline"
      >
        {selected.size === allKeywords.length
          ? "全解除"
          : "全選択"}
      </button>

      <button
        onClick={onDelete}
        disabled={selected.size === 0 || loading}
        className={`px-4 py-1 rounded text-sm text-white ${
          selected.size === 0 || loading
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-red-600 hover:bg-red-700"
        }`}
      >
        選択したキーワードを削除
      </button>
    </div>
  );
}
