export default function QuizMiniCard({ quiz, onClick }) {
  const hasScore = quiz.best_score !== null && quiz.best_score !== undefined;
  const scoreColor = hasScore
    ? (quiz.best_score >= 70 ? "var(--color-success)" : quiz.best_score >= 50 ? "var(--color-accent)" : "var(--color-error)")
    : "var(--color-muted)";

  return (
    <div onClick={onClick}
      className="flex items-center gap-3 py-3 px-3.5 rounded-xl border border-border bg-white cursor-pointer transition-all hover:bg-[#FAFFFE] hover:shadow-[0_2px_8px_rgba(0,60,50,0.06)]"
    >
      {/* Quiz icon */}
      <div className="w-9 h-9 rounded-[10px] shrink-0 bg-quiz-light flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-quiz)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-text overflow-hidden text-ellipsis whitespace-nowrap">
          {quiz.title}
        </div>
        <div className="text-xs font-semibold text-muted mt-0.5">
          {quiz.question_count} question{quiz.question_count !== 1 ? "s" : ""}
          {hasScore ? ` \u00b7 Best: ${quiz.best_score}%` : " \u00b7 Not started"}
        </div>
      </div>

      {/* Score or dash */}
      <div className="text-[15px] font-extrabold shrink-0" style={{ color: scoreColor }}>
        {hasScore ? `${quiz.best_score}%` : "\u2014"}
      </div>

      {/* Chevron */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}
