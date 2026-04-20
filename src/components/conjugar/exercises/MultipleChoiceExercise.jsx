import { cn } from "@/lib/utils";
import Blank from "../Blank";
import ExerciseHeader from "../ExerciseHeader";

export default function MultipleChoiceExercise({ exercise, onAnswer, feedback, answer }) {
  const selected = answer ?? null;
  const parts = exercise.sentence.split("___");

  const blankValue = selected !== null ? exercise.options[selected] : "";
  const blankFeedback = feedback
    ? { correct: selected === exercise.correctIndex }
    : null;
  const expected =
    feedback && selected !== exercise.correctIndex
      ? exercise.options[exercise.correctIndex]
      : undefined;

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto">
      <ExerciseHeader type="multiple_choice" verb={exercise._verb || exercise.verb} tense={exercise._tense} person={exercise.person} />

      <p className="text-2xl font-bold text-gray-800 text-center leading-relaxed flex flex-wrap items-baseline justify-center gap-x-1 mb-8">
        {parts[0]}
        <Blank
          readOnly
          value={blankValue}
          feedback={blankFeedback}
          expected={expected}
          textClass="text-2xl font-bold"
        />
        {parts.slice(1).join("___")}
      </p>

      <div className="grid grid-cols-2 gap-3 w-full">
        {exercise.options.map((opt, i) => {
          const isCorrect = feedback && i === exercise.correctIndex;
          const isSelected = selected === i;
          const wasWrong = feedback && isSelected && i !== exercise.correctIndex;

          return (
            <button
              key={i}
              onClick={() => !feedback && onAnswer(i)}
              disabled={!!feedback}
              className={cn(
                "px-4 py-4 rounded-xl border-2 text-lg font-bold transition-all",
                !feedback && !isSelected && "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
                !feedback && isSelected && "border-green-400 bg-green-50 text-green-700",
                isCorrect && "border-green-500 bg-green-50 text-green-700",
                wasWrong && "border-red-400 bg-red-50 text-red-600",
              )}
            >
              {opt}
              {isCorrect && feedback && <span className="ml-1">✓</span>}
              {wasWrong && <span className="ml-1">✗</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
