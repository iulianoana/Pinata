import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Inline fill-in-the-blank.
 * - readOnly=false renders an <input>; readOnly=true renders a <span> showing `value`.
 * - Empty state: underline only, no placeholder dashes.
 * - Feedback: green/red border; if incorrect, the expected answer is shown below.
 */
const Blank = forwardRef(function Blank(
  {
    value = "",
    onChange,
    onKeyDown,
    readOnly = false,
    disabled = false,
    feedback,
    expected,
    widthClass = "w-28",
    textClass = "text-2xl font-bold",
    placeholder = "",
  },
  ref,
) {
  const borderClass = !feedback
    ? "border-green-400"
    : feedback.correct
      ? "border-green-500 text-green-700"
      : "border-red-500 text-red-700";

  const commonClasses = cn(
    widthClass,
    textClass,
    "text-center border-b-2 outline-none bg-transparent pb-0.5 transition-colors",
    borderClass,
  );

  return (
    <span className="inline-flex flex-col items-center mx-1 align-baseline">
      {readOnly ? (
        <span
          className={cn(
            commonClasses,
            "inline-block min-h-[1.3em] leading-tight select-none",
            !value && "text-transparent",
          )}
        >
          {value || "\u00A0"}
        </span>
      ) : (
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          disabled={disabled || !!feedback}
          placeholder={placeholder}
          className={commonClasses}
        />
      )}
      {feedback && !feedback.correct && expected && (
        <span className="text-xs font-semibold text-green-600 mt-0.5">
          {expected}
        </span>
      )}
    </span>
  );
});

export default Blank;
