import { useState, useRef, useCallback } from "react";
import { C } from "../../styles/theme";
import { createQuiz } from "../../lib/api";
import { validateQuizJson } from "../../lib/validators/quiz-json";

export default function AddQuizModal({ open, onClose, onSuccess, context }) {
  // context: { type: 'lesson'|'week', lessonId?, lessonTitle?, weekId?, weekTitle? }
  const [attachTo, setAttachTo] = useState(context?.type || "lesson");
  const [file, setFile] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const dragCounter = useRef(0);

  const resetState = useCallback(() => {
    setAttachTo(context?.type || "lesson");
    setFile(null);
    setQuizData(null);
    setTitle("");
    setError("");
    setSaving(false);
    setDragging(false);
    dragCounter.current = 0;
  }, [context?.type]);

  const handleFile = useCallback((f) => {
    setError("");
    if (!f) return;
    if (!f.name.endsWith(".json")) {
      setError("Please upload a .json file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const result = validateQuizJson(data);
        if (!result.valid) {
          setError(result.error);
          return;
        }
        setFile(f);
        setQuizData(data);
        setTitle(f.name.replace(/\.json$/i, "").replace(/[_-]/g, " "));
      } catch {
        setError("Invalid JSON file");
      }
    };
    reader.readAsText(f);
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) { setError("Title is required"); return; }
    if (!quizData) { setError("Please upload a quiz file"); return; }

    setSaving(true);
    setError("");
    try {
      const payload = { title: title.trim(), quiz_data: quizData };
      if (attachTo === "lesson") {
        payload.lesson_id = context.lessonId;
      } else {
        payload.week_id = context.weekId;
      }
      await createQuiz(payload);
      resetState();
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e.message || "Failed to create quiz");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!open) return null;

  const hasLesson = context?.lessonId && context?.lessonTitle;
  const hasWeek = context?.weekId && context?.weekTitle;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: C.overlay, animation: "overlayFade 0.2s ease-out",
    }} onClick={handleClose}>
      <div className="slide-up" style={{
        background: C.card, borderRadius: 20, padding: 32,
        width: "calc(100% - 48px)", maxWidth: 480,
        boxShadow: "0 8px 32px rgba(0,60,50,0.15)",
        maxHeight: "85vh", overflowY: "auto",
      }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Add a Quiz</h3>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginTop: 4 }}>
              Attach a quiz to this lesson or unit
            </p>
          </div>
          <button onClick={handleClose} style={{
            background: "none", border: "none", cursor: "pointer", color: C.muted,
            padding: 4, display: "flex", transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Attach To selector */}
        <label style={{
          display: "block", fontSize: 11, fontWeight: 800, color: C.muted,
          textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8,
        }}>
          Attach to
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {hasLesson && (
            <button onClick={() => setAttachTo("lesson")} style={{
              flex: 1, display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 12,
              border: `2px solid ${attachTo === "lesson" ? "#8B5CF6" : C.border}`,
              background: attachTo === "lesson" ? "#EDE9FE" : "transparent",
              color: attachTo === "lesson" ? "#8B5CF6" : C.text,
              fontWeight: 700, fontSize: 13, cursor: "pointer",
              fontFamily: "'Nunito', sans-serif", transition: "all 0.15s",
              overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{context.lessonTitle}</span>
            </button>
          )}
          {hasWeek && (
            <button onClick={() => setAttachTo("week")} style={{
              flex: 1, display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 12,
              border: `2px solid ${attachTo === "week" ? "#8B5CF6" : C.border}`,
              background: attachTo === "week" ? "#EDE9FE" : "transparent",
              color: attachTo === "week" ? "#8B5CF6" : C.text,
              fontWeight: 700, fontSize: 13, cursor: "pointer",
              fontFamily: "'Nunito', sans-serif", transition: "all 0.15s",
              overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{context.weekTitle}</span>
            </button>
          )}
        </div>

        {/* Method selector */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {/* Upload JSON */}
          <button onClick={() => {}} style={{
            padding: "20px 16px", borderRadius: 14,
            border: "2px solid #8B5CF6",
            background: "#EDE9FE",
            cursor: "default", textAlign: "center",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 10px",
            }}>
              <span style={{ fontSize: 20 }}>📤</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Upload JSON</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>
              Import a quiz file you've already prepared
            </div>
          </button>

          {/* Generate with AI (coming soon) */}
          <div style={{
            padding: "20px 16px", borderRadius: 14,
            border: `2px solid ${C.border}`, background: "transparent",
            textAlign: "center", position: "relative", opacity: 0.6,
          }}>
            <div style={{
              position: "absolute", top: 8, right: 8,
              padding: "2px 8px", borderRadius: 6,
              background: "#FEF3C7", color: "#92400E",
              fontSize: 10, fontWeight: 800,
            }}>Coming soon</div>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 10px",
            }}>
              <span style={{ fontSize: 20 }}>✨</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Generate with AI</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>
              Auto-create from lesson PDF or content
            </div>
          </div>
        </div>

        {/* Upload zone (when no file selected) */}
        {!file && (
          <div
            onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setDragging(true); }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setDragging(false); } }}
            onDrop={(e) => { e.preventDefault(); dragCounter.current = 0; setDragging(false); handleFile(e.dataTransfer?.files?.[0]); }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? "#8B5CF6" : C.border}`,
              borderRadius: 14, padding: "32px 16px", textAlign: "center",
              cursor: "pointer", transition: "all 0.2s",
              background: dragging ? "#EDE9FE" : "transparent",
              marginBottom: 16,
            }}
          >
            <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files?.[0])} />
            <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
              Drop your quiz JSON here
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 4 }}>
              or <span style={{ color: "#8B5CF6", fontWeight: 700 }}>click to browse</span> · .json files only
            </div>
          </div>
        )}

        {/* File selected — show filename + title input */}
        {file && (
          <div style={{ marginBottom: 16 }}>
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
                {quizData?.questions?.length || 0} questions
              </span>
              <button onClick={() => { setFile(null); setQuizData(null); setTitle(""); setError(""); }} style={{
                background: "none", border: "none", cursor: "pointer", color: C.muted,
                padding: 2, display: "flex",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <label style={{
              display: "block", fontSize: 11, fontWeight: 800, color: C.muted,
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6,
            }}>
              Quiz title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter quiz title"
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 12,
                border: `1.5px solid ${C.border}`, background: C.inputBg,
                fontSize: 15, fontWeight: 600, color: C.text,
                fontFamily: "'Nunito', sans-serif", outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#8B5CF6")}
              onBlur={(e) => (e.target.style.borderColor = C.border)}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <p style={{ color: C.error, fontSize: 13, fontWeight: 600, textAlign: "center", marginBottom: 12 }}>{error}</p>
        )}

        {/* Footer buttons */}
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button onClick={handleClose} style={{
            flex: 1, padding: "14px", borderRadius: 14,
            border: `2px solid ${C.border}`, background: "transparent",
            color: C.text, fontWeight: 700, fontSize: 15,
            cursor: "pointer", fontFamily: "'Nunito', sans-serif", minHeight: 48,
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !quizData} style={{
            flex: 1, padding: "14px", borderRadius: 14, border: "none",
            background: saving || !quizData ? "#C4B5FD" : "#8B5CF6",
            color: "white", fontWeight: 800, fontSize: 15,
            cursor: saving || !quizData ? "default" : "pointer",
            fontFamily: "'Nunito', sans-serif", minHeight: 48,
            transition: "background 0.15s",
          }}>
            {saving ? "Adding..." : "Add Quiz"}
          </button>
        </div>
      </div>
    </div>
  );
}
