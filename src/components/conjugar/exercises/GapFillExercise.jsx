import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { getExerciseMeta } from "../shared";

export default function GapFillExercise({ exercise, onAnswer, feedback, answer = "" }) {
  const meta = getExerciseMeta("gap_fill");
  const parts = exercise.sentence.split("___");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!feedback && inputRef.current) inputRef.current.focus();
  }, [exercise, feedback]);

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto">
      <span className="text-sm font-bold mb-6" style={{ color: meta.color }}>
        {meta.icon} {meta.label}
      </span>

      <p className="text-2xl font-bold text-gray-800 text-center leading-relaxed flex flex-wrap items-baseline justify-center gap-x-1">
        {parts[0]}
        <span className="inline-flex flex-col items-center mx-1">
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onChange={(e) => onAnswer(e.target.value)}
            disabled={!!feedback}
            className={cn(
              "w-28 text-center text-2xl font-bold border-b-2 outline-none bg-transparent pb-0.5",
              !feedback && "border-green-400 text-gray-800",
              feedback?.correct && "border-green-500 text-green-700",
              feedback && !feedback.correct && "border-red-500 text-red-700"
            )}
            placeholder=""
          />
          {feedback && !feedback.correct && (
            <span className="text-sm font-semibold text-green-600 mt-1">
              {feedback.expected}
            </span>
          )}
        </span>
        {parts[1]}
      </p>

      {exercise.hint && (
        <div className="mt-8 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold flex items-center gap-2">
          <span>💡</span> Pista: {exercise.hint}
        </div>
      )}
    </div>
  );
}
