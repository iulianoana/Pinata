import { useState, useRef, useCallback } from "react";
import { C } from "../styles/theme";
import { createQuiz } from "../lib/api";
import { validateQuizJson } from "../lib/validators/quiz-json";

export default function AddQuizSheet({ open, onClose, onLoad, context, onSuccess }) {
  // context: { type, lessonId, lessonTitle, weekId, weekTitle }
  // Backward compat: if no context, works like old version (just onLoad)
  const ref = useRef(null);
  const [err, setErr] = useState("");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const dragCounter = useRef(0);

  const reset = () => {
    setErr(""); setDragging(false);
    setFile(null); setQuizData(null); setTitle(""); setSaving(false);
    dragCounter.current = 0;
  };

  const handleFile = useCallback((f) => {
    setErr("");
    if (!f) return;
    if (!f.name.endsWith(".json")) {
      setErr("Please upload a .json file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const result = validateQuizJson(data);
        if (!result.valid) {
          setErr(result.error);
          return;
        }
        // Legacy mode: no context, just forward data
        if (!context) {
          onLoad(data);
          reset();
          onClose();
          return;
        }
        setFile(f);
        setQuizData(data);
        setTitle(f.name.replace(/\.json$/i, "").replace(/[_-]/g, " "));
      } catch {
        setErr("Invalid file. Please upload a valid quiz JSON.");
      }
    };
    reader.readAsText(f);
  }, [context, onLoad, onClose]);

  const handleSubmit = async () => {
    if (!title.trim()) { setErr("Title is required"); return; }
    if (!quizData) return;
    setSaving(true);
    setErr("");
    try {
      const payload = { title: title.trim(), quiz_data: quizData };
      if (context.type === "lesson") payload.lesson_id = context.lessonId;
      else payload.week_id = context.weekId;
      await createQuiz(payload);
      reset();
      onSuccess?.();
      onClose();
    } catch (e) {
      setErr(e.message || "Failed to create quiz");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { reset(); onClose(); };

  if (!open) return null;

  const attachLabel = context
    ? (context.type === "lesson"
      ? `Attach to ${context.lessonTitle}`
      : `Attach to ${context.weekTitle}`)
    : null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-end",
      justifyContent: "center", background: C.overlay, animation: "overlayFade 0.2s ease-out",
    }} onClick={handleClose}>
      <div style={{
        background: C.card, borderRadius: "20px 20px 0 0", padding: "12px 24px 32px",
        width: "100%", maxWidth: 480, animation: "sheetUp 0.3s ease-out",
        paddingBottom: "max(32px, env(safe-area-inset-bottom, 32px))",
      }} onClick={(e) => e.stopPropagation()}
        onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setDragging(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setDragging(false); } }}
        onDrop={(e) => { e.preventDefault(); dragCounter.current = 0; setDragging(false); handleFile(e.dataTransfer?.files?.[0]); }}
      >
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 16px" }} />

        {/* Header */}
        <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>Add a Quiz</h3>
        {attachLabel && (
          <p style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 16 }}>{attachLabel}</p>
        )}

        {/* Method selector (only with context) */}
        {context && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <button onClick={() => {}} style={{
              padding: "14px 12px", borderRadius: 12,
              border: "2px solid #8B5CF6",
              background: "#EDE9FE",
              cursor: "default", textAlign: "center",
            }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>📤</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Upload JSON</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginTop: 2 }}>Import a prepared file</div>
            </button>
            <div style={{
              padding: "14px 12px", borderRadius: 12,
              border: `2px solid ${C.border}`, background: "transparent",
              textAlign: "center", position: "relative", opacity: 0.6,
            }}>
              <div style={{
                position: "absolute", top: 6, right: 6,
                padding: "2px 6px", borderRadius: 4,
                background: "#FEF3C7", color: "#92400E",
                fontSize: 9, fontWeight: 800,
              }}>Soon</div>
              <div style={{ fontSize: 20, marginBottom: 6 }}>✨</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Generate with AI</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginTop: 2 }}>From lesson content</div>
            </div>
          </div>
        )}

        {/* File selection */}
        {!file ? (
          <>
            <button onClick={() => ref.current?.click()} style={{
              width: "100%", padding: "14px 24px", borderRadius: 14, border: "none",
              background: "#8B5CF6", color: "white", fontWeight: 800, fontSize: 15,
              cursor: "pointer", fontFamily: "'Nunito', sans-serif", minHeight: 52,
              transition: "filter 0.1s",
            }}
            onMouseEnter={(e) => (e.target.style.filter = "brightness(1.08)")}
            onMouseLeave={(e) => (e.target.style.filter = "none")}>
              Choose File & Upload
            </button>
            <input ref={ref} type="file" accept=".json" style={{ display: "none" }}
              onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
            {dragging && (
              <div style={{
                border: "2px dashed #8B5CF6", borderRadius: 12,
                padding: "16px", textAlign: "center", marginTop: 12,
                background: "#EDE9FE",
              }}>
                <p style={{ color: "#8B5CF6", fontSize: 14, fontWeight: 700 }}>Drop your file here</p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* File info */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
              background: "#EDE9FE", borderRadius: 10, marginBottom: 12,
            }}>
              <span style={{ fontSize: 16 }}>📄</span>
              <span style={{
                flex: 1, fontSize: 13, fontWeight: 700, color: "#8B5CF6",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {file.name}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>
                {quizData?.questions?.length || 0} q
              </span>
              <button onClick={() => { setFile(null); setQuizData(null); setTitle(""); setErr(""); }} style={{
                background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 2, display: "flex",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Title input */}
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Quiz title"
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 12,
                border: `1.5px solid ${C.border}`, background: C.inputBg,
                fontSize: 15, fontWeight: 600, color: C.text,
                fontFamily: "'Nunito', sans-serif", outline: "none", marginBottom: 12,
              }}
              onFocus={(e) => (e.target.style.borderColor = "#8B5CF6")}
              onBlur={(e) => (e.target.style.borderColor = C.border)}
            />

            {/* Submit */}
            <button onClick={handleSubmit} disabled={saving} style={{
              width: "100%", padding: "14px", borderRadius: 14, border: "none",
              background: saving ? "#C4B5FD" : "#8B5CF6", color: "white",
              fontWeight: 800, fontSize: 15, cursor: saving ? "default" : "pointer",
              fontFamily: "'Nunito', sans-serif", minHeight: 52,
            }}>
              {saving ? "Adding..." : "Add Quiz"}
            </button>
          </>
        )}

        {err && <p style={{ color: C.error, fontSize: 13, fontWeight: 600, marginTop: 12, textAlign: "center" }}>{err}</p>}
      </div>
    </div>
  );
}
