import { SPANISH_TENSES } from "@/lib/conjugar/constants";

export default function BlankLabel({ person, tense }) {
  if (!person) return null;
  const tenseLabel = SPANISH_TENSES.find((t) => t.id === tense)?.label || tense;
  return (
    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
      {person} {tenseLabel ? <span className="text-gray-300">·</span> : null} {tenseLabel?.toLowerCase()}
    </span>
  );
}
