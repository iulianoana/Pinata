import { C } from "../../styles/theme";

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Toggle({ on, onChange }) {
  return (
    <button
      onClick={onChange}
      aria-checked={on}
      role="switch"
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: on ? "#3dba6f" : "#d1d5db",
        border: "none", cursor: "pointer",
        position: "relative", transition: "background 0.2s",
        flexShrink: 0, padding: 0,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 9,
        background: "white", position: "absolute",
        top: 3, left: on ? 23 : 3,
        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }} />
    </button>
  );
}

export default function GenerateFromPDFOptions({
  fileInfo, genSummary, genQuiz, modelName,
  onToggleSummary, onToggleQuiz, onGenerate, onCancel,
}) {
  const anyAI = genSummary || genQuiz;

  let ctaText = "Create lesson";
  if (genSummary && genQuiz) ctaText = "Generate summary & quiz";
  else if (genSummary) ctaText = "Generate summary";
  else if (genQuiz) ctaText = "Generate quiz";

  return (
    <>
      {/* Uploaded file card */}
      <div style={{
        background: "#fdf0f3", border: "1px solid rgba(232, 118, 138, 0.2)",
        borderRadius: 12, padding: "12px 14px",
        display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: "rgba(232, 118, 138, 0.15)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e8768a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: C.text,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            fontFamily: "'Nunito', sans-serif",
          }}>
            {fileInfo?.fileName}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 1, fontFamily: "'Nunito', sans-serif" }}>
            {formatFileSize(fileInfo?.fileSize)} · Ready
          </div>
        </div>
        {/* Green checkmark */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3dba6f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      {/* AI Generation card */}
      <div style={{
        border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 16,
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 14px", borderBottom: `1px solid ${C.border}`,
        }}>
          <span style={{ color: "#8b5cf6", fontSize: 14, lineHeight: 1 }}>&#10022;</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "'Nunito', sans-serif" }}>
            AI Generation
          </span>
          <span style={{
            fontSize: 9, fontWeight: 800, color: "#8b5cf6",
            background: "#f3f0ff", padding: "2px 7px", borderRadius: 20,
            letterSpacing: "0.05em", textTransform: "uppercase",
            fontFamily: "'Nunito', sans-serif",
          }}>
            OPTIONAL
          </span>
        </div>

        {/* Summary toggle */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 14px", borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "#f3f0ff", display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "'Nunito', sans-serif" }}>
              Lesson Summary
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 1, fontFamily: "'Nunito', sans-serif" }}>
              Structured markdown from the PDF
            </div>
          </div>
          <Toggle on={genSummary} onChange={onToggleSummary} />
        </div>

        {/* Quiz toggle */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 14px",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "rgba(61, 186, 111, 0.1)", display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3dba6f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "'Nunito', sans-serif" }}>
              Generate Quiz
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 1, fontFamily: "'Nunito', sans-serif" }}>
              15 questions · vocab, grammar, phrases
            </div>
          </div>
          <Toggle on={genQuiz} onChange={onToggleQuiz} />
        </div>
      </div>

      {/* Model indicator */}
      <div style={{
        textAlign: "center", marginBottom: 20,
        fontSize: 11, fontWeight: 600, color: "#9ca3af",
        fontFamily: "'Nunito', sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 3, background: "#3dba6f", display: "inline-block",
        }} />
        {modelName || "AI Model"} · ~20s per task
      </div>

      {/* Footer buttons */}
      <div className="gpdf-footer">
        <button
          onClick={onCancel}
          className="gpdf-footer-cancel"
          style={{
            padding: "12px 20px", borderRadius: 10,
            border: `1.5px solid ${C.border}`, background: C.card,
            color: C.text, fontWeight: 700, fontSize: 14,
            cursor: "pointer", fontFamily: "'Nunito', sans-serif",
            transition: "border-color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = C.muted)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
        >
          Cancel
        </button>
        <button
          onClick={onGenerate}
          className="gpdf-footer-cta"
          style={{
            padding: "12px 20px", borderRadius: 10, border: "none",
            background: anyAI ? "#3dba6f" : "#d1d5db",
            color: anyAI ? "white" : "#6b7280",
            fontWeight: 700, fontSize: 14, cursor: "pointer",
            fontFamily: "'Nunito', sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "filter 0.15s",
          }}
          onMouseEnter={e => { if (anyAI) e.currentTarget.style.filter = "brightness(1.08)"; }}
          onMouseLeave={e => (e.currentTarget.style.filter = "none")}
        >
          {anyAI && <span style={{ fontSize: 13 }}>&#10022;</span>}
          {ctaText}
        </button>
      </div>
    </>
  );
}
