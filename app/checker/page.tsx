import DictionaryMissingSection from "@/components/DictionaryMissingSection";
import DictionaryUnusedSection from "@/components/DictionaryUnusedSection";
import DictionaryManageSection from "@/components/DictionaryManageSection";
import SearchDictionary from "@/components/SearchDictionary";

export default function Page() {
  return (
    <div className="max-w-5xl mx-auto p-8 space-y-14">
      <DictionaryMissingSection />
      <DictionaryUnusedSection />
      <DictionaryManageSection />
    </div>
  );
}
