import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import Blank from "../Blank";
import BlankLabel from "../BlankLabel";
import ExerciseHeader from "../ExerciseHeader";

export default function ChatBubbleExercise({ exercise, onAnswer, feedback, answer = "" }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!feedback && inputRef.current) inputRef.current.focus();
  }, [exercise, feedback]);

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto">
      <ExerciseHeader type="chat_bubble" verb={exercise._verb} tense={exercise._tense} person={exercise.person} />

      <div className="w-full flex flex-col gap-3">
        {exercise.messages.map((msg, i) => {
          const hasBlank = msg.blankPosition;

          return (
            <div key={i} className={cn("flex flex-col", msg.isUser ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[80%] px-4 py-3 rounded-2xl text-base font-medium",
                  msg.isUser
                    ? "bg-green-50 border border-green-200 text-gray-800 rounded-br-md"
                    : "bg-gray-100 text-gray-800 rounded-bl-md",
                )}
              >
                {(() => {
                  const fullText = hasBlank
                    ? `${msg.blankPosition.before}___${msg.blankPosition.after}`
                    : msg.text || "";
                  const blankParts = fullText.split("___");

                  if (blankParts.length < 2) return fullText;

                  return (
                    <span className="leading-relaxed inline-flex flex-wrap items-baseline">
                      <span>{blankParts[0]}</span>
                      <span className="inline-flex flex-col items-center">
                        <Blank
                          ref={inputRef}
                          value={answer}
                          onChange={(e) => onAnswer(e.target.value)}
                          feedback={feedback}
                          expected={feedback?.expected}
                          widthClass="w-24"
                          textClass="text-base font-bold"
                        />
                        <BlankLabel person={exercise.person} tense={exercise._tense} />
                      </span>
                      <span>{blankParts.slice(1).join("___")}</span>
                    </span>
                  );
                })()}
              </div>
              <span className="text-xs text-gray-400 mt-1 px-1">
                {msg.isUser ? "Tú" : msg.sender}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
