import { cn } from "@/lib/utils";
import { getExerciseMeta } from "../shared";

export default function SpotErrorExercise({ exercise, onAnswer, feedback, answer }) {
  const meta = getExerciseMeta("spot_error");
  const selected = answer ?? null;

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto">
      <span className="text-sm font-bold mb-2" style={{ color: meta.color }}>
        {meta.icon} {meta.label}
      </span>
      <p className="text-gray-500 text-sm font-semibold mb-6">
        Toca la palabra incorrecta
      </p>

      <p className="text-xl font-semibold text-gray-800 leading-[2.4] text-center">
        {exercise.words.map((word, i) => {
          const isError = feedback && i === exercise.errorIndex;
          const isSelected = selected === i;
          const gotItRight = feedback?.correct && isError;
          const wasWrong = feedback && isSelected && !feedback.correct;
          const revealError = isError && !feedback.correct;

          return (
            <span key={i}>
              <button
                onClick={() => !feedback && onAnswer(i)}
                disabled={!!feedback}
                className={cn(
                  "inline rounded-lg px-1.5 py-0.5 text-xl font-semibold transition-all",
                  !feedback && !isSelected && "text-gray-800 hover:bg-gray-100 active:bg-blue-50",
                  !feedback && isSelected && "bg-blue-100 text-blue-700 ring-2 ring-blue-400",
                  gotItRight && "bg-green-100 text-green-600 line-through",
                  revealError && "bg-red-100 text-red-500 line-through",
                  wasWrong && "bg-red-100 text-red-400",
                  feedback && !isError && !wasWrong && "text-gray-400"
                )}
              >
                {word}
              </button>
              {i < exercise.words.length - 1 && " "}
            </span>
          );
        })}
      </p>

      {feedback && (
        <div className="mt-6 text-center">
          <p className="text-sm font-semibold text-green-600">
            {exercise.errorWord} → {exercise.correctWord}
          </p>
          <p className="text-xs text-gray-500 mt-1">{exercise.explanation}</p>
        </div>
      )}
    </div>
  );
}
