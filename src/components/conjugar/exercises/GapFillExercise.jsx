import { useRef, useEffect } from "react";
import Blank from "../Blank";
import BlankLabel from "../BlankLabel";
import ExerciseHeader from "../ExerciseHeader";

export default function GapFillExercise({ exercise, onAnswer, feedback, answer = "" }) {
  const parts = exercise.sentence.split("___");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!feedback && inputRef.current) inputRef.current.focus();
  }, [exercise, feedback]);

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto">
      <ExerciseHeader type="gap_fill" verb={exercise._verb} tense={exercise._tense} />

      <p className="text-2xl font-bold text-gray-800 text-center leading-relaxed flex flex-wrap items-baseline justify-center gap-x-1">
        {parts[0]}
        <span className="inline-flex flex-col items-center">
          <Blank
            ref={inputRef}
            value={answer}
            onChange={(e) => onAnswer(e.target.value)}
            feedback={feedback}
            expected={feedback?.expected}
          />
          <BlankLabel person={exercise.person} tense={exercise._tense} />
        </span>
        {parts[1]}
      </p>
    </div>
  );
}
