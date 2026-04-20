import { SPANISH_TENSES } from "@/lib/conjugar/constants";
import { getExerciseMeta } from "./shared";

export default function ExerciseHeader({ type, verb, tense }) {
  const meta = getExerciseMeta(type);
  const tenseLabel = SPANISH_TENSES.find((t) => t.id === tense)?.label || tense;

  return (
    <div className="flex flex-col items-center mb-6">
      <span className="text-sm font-bold" style={{ color: meta.color }}>
        {meta.icon} {meta.label}
      </span>
      {verb && (
        <p className="text-base font-bold text-gray-600 mt-1">
          {verb} <span className="text-gray-400">·</span> {tenseLabel}
        </p>
      )}
    </div>
  );
}
