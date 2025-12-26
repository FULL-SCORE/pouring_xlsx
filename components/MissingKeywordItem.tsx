"use client";

type Props = {
  keyword: string;
  usedCount: number;
  hiragana: string;
  alphabet: string;
  onChangeHiragana: (v: string) => void;
  onChangeAlphabet: (v: string) => void;
  onAdd: () => void;
  loading: boolean;
};

export default function MissingKeywordItem({
  keyword,
  usedCount,
  hiragana,
  alphabet,
  onChangeHiragana,
  onChangeAlphabet,
  onAdd,
  loading,
}: Props) {
  const canSubmit = hiragana.trim() && alphabet.trim();

  return (
    <div className="border rounded-md p-4 space-y-2">
      <div className="font-medium">
        {keyword}（{usedCount}）
      </div>

      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="ひらがな（必須）"
          value={hiragana}
          onChange={(e) => onChangeHiragana(e.target.value)}
          className="border px-2 py-1 rounded w-1/3"
        />

        <input
          type="text"
          placeholder="ローマ字（必須）"
          value={alphabet}
          onChange={(e) => onChangeAlphabet(e.target.value)}
          className="border px-2 py-1 rounded w-1/3"
        />

        <button
          disabled={!canSubmit || loading}
          onClick={onAdd}
          className={`px-4 py-1 rounded text-sm text-white ${
            !canSubmit || loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "追加中…" : "追加"}
        </button>
      </div>

      {!canSubmit && (
        <p className="text-xs text-red-500">
          ※ ひらがな・ローマ字の両方が必須です
        </p>
      )}
    </div>
  );
}
