import { cn } from "@/lib/utils";
import ExerciseHeader from "../ExerciseHeader";
import { SPANISH_TENSES } from "@/lib/conjugar/constants";

export default function OddOneOutExercise({ exercise, onAnswer, feedback, answer }) {
  const selected = answer ?? null;
  const tenseLabel = SPANISH_TENSES.find((t) => t.id === exercise._tense)?.label || exercise.tenseLabel;

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto">
      <ExerciseHeader type="odd_one_out" verb={exercise._verb || exercise.verb} tense={exercise._tense} />

      <p className="text-xl font-bold text-gray-800 text-center mb-8">
        ¿Cuál NO pertenece al {tenseLabel?.toLowerCase()}?
      </p>

      <div className="grid grid-cols-2 gap-3 w-full">
        {exercise.options.map((opt, i) => {
          const isOdd = feedback && i === exercise.oddIndex;
          const isSelected = selected === i;
          const wasWrong = feedback && isSelected && i !== exercise.oddIndex;
          const correctPick = feedback && isSelected && i === exercise.oddIndex;

          return (
            <button
              key={i}
              onClick={() => !feedback && onAnswer(i)}
              disabled={!!feedback}
              className={cn(
                "px-4 py-4 rounded-xl border-2 text-lg font-bold transition-all",
                !feedback && !isSelected && "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
                !feedback && isSelected && "border-blue-400 bg-blue-50 text-blue-700",
                isOdd && "border-red-400 bg-red-50 text-red-500 line-through",
                correctPick && "border-green-500 bg-green-50 text-green-700 no-underline",
                wasWrong && "border-red-300 bg-red-50 text-red-400",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {feedback && (
        <p className="mt-6 text-sm text-gray-500 text-center font-medium">
          {exercise.explanation}
        </p>
      )}
    </div>
  );
}
