import { C } from "../../styles/theme";

export default function QuizMiniCard({ quiz, onClick }) {
  const hasScore = quiz.best_score !== null && quiz.best_score !== undefined;
  const scoreColor = hasScore
    ? (quiz.best_score >= 70 ? C.success : quiz.best_score >= 50 ? C.accent : C.error)
    : C.muted;

  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", borderRadius: 12,
      border: `1px solid ${C.border}`, background: C.card,
      cursor: "pointer", transition: "all 0.15s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = "#FAFFFE"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,60,50,0.06)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = C.card; e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Quiz icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: "#EDE9FE",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {quiz.title}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 2 }}>
          {quiz.question_count} question{quiz.question_count !== 1 ? "s" : ""}
          {hasScore ? ` \u00b7 Best: ${quiz.best_score}%` : " \u00b7 Not started"}
        </div>
      </div>

      {/* Score or dash */}
      <div style={{ fontSize: 15, fontWeight: 800, color: scoreColor, flexShrink: 0 }}>
        {hasScore ? `${quiz.best_score}%` : "\u2014"}
      </div>

      {/* Chevron */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}
