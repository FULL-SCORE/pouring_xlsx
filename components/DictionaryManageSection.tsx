import AddDictionaryForm from "./AddDictionaryForm";
import SearchDictionary from "./SearchDictionary";

export default function DictionaryManageSection() {
  return (
    <section className="space-y-10">
      <AddDictionaryForm />
      <SearchDictionary />
    </section>
  );
}
