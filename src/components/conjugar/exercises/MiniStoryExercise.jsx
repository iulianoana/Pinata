import { useRef, useEffect } from "react";
import Blank from "../Blank";
import BlankLabel from "../BlankLabel";
import ExerciseHeader from "../ExerciseHeader";

export default function MiniStoryExercise({ exercise, onAnswer, feedback, answer = [] }) {
  const inputRefs = useRef([]);
  let blankIdx = 0;

  const blankCount = exercise.segments.filter((s) => s.isBlank).length;

  useEffect(() => {
    if (!feedback && inputRefs.current[0]) inputRefs.current[0].focus();
  }, [exercise, feedback]);

  const handleChange = (idx, value) => {
    const next = [...answer];
    next[idx] = value;
    onAnswer(next);
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (idx < blankCount - 1 && inputRefs.current[idx + 1]) {
        e.nativeEvent.stopPropagation();
        inputRefs.current[idx + 1].focus();
      }
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto">
      <ExerciseHeader type="mini_story" verb={exercise._verb} tense={exercise._tense} person={exercise.person} />

      <div className="w-full rounded-2xl border border-gray-200 bg-white p-5">
        <p className="text-xl font-semibold text-gray-800 leading-relaxed">
          {exercise.segments.map((seg, i) => {
            if (!seg.isBlank) {
              return <span key={i}>{seg.text}</span>;
            }
            const idx = blankIdx++;
            const fb = feedback?.details?.[idx];
            return (
              <span key={i} className="inline-flex flex-col items-center">
                <Blank
                  ref={(el) => (inputRefs.current[idx] = el)}
                  value={answer[idx] || ""}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  feedback={fb}
                  expected={fb?.expected}
                  textClass="text-xl font-semibold"
                />
                <BlankLabel person={exercise.person} tense={exercise._tense} />
              </span>
            );
          })}
        </p>
      </div>
    </div>
  );
}
