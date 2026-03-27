import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../../styles/theme";
import { createQuiz, getPrompts, generateInstantQuiz } from "../../lib/api";
import { validateQuizJson } from "../../lib/validators/quiz-json";

const ACCEPTED_MEDIA = "image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf";

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      const mediaType = file.type || inferMediaType(file.name);
      resolve({ base64, mediaType, name: file.name, size: file.size });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function inferMediaType(name) {
  const ext = name.split(".").pop().toLowerCase();
  const map = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" };
  return map[ext] || "application/octet-stream";
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mediaType) {
  if (mediaType === "application/pdf") return "📄";
  return "🖼️";
}

function fileTypeLabel(mediaType) {
  if (mediaType === "application/pdf") return "PDF";
  if (mediaType === "image/png") return "PNG";
  if (mediaType === "image/jpeg") return "JPG";
  if (mediaType === "image/webp") return "WEBP";
  return "File";
}

export default function AddQuizModal({ open, onClose, onSuccess, context }) {
  // context: { type: 'lesson'|'week', lessonId?, lessonTitle?, weekId?, weekTitle? }
  const navigate = useNavigate();
  const [mode, setMode] = useState("select"); // "select" | "upload" | "generate" | "success"
  const [attachTo, setAttachTo] = useState(context?.type || "lesson");

  // Upload JSON state
  const [file, setFile] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const [title, setTitle] = useState("");

  // Generate state
  const [mediaFiles, setMediaFiles] = useState([]);
  const [specificRequirements, setSpecificRequirements] = useState("");
  const [numberOfQuestions, setNumberOfQuestions] = useState(15);
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null); // { quizId, title, questionCount }
  const [lessonPrompts, setLessonPrompts] = useState([]);
  const [selectedPromptSlug, setSelectedPromptSlug] = useState("instant-quiz-generator");

  // Shared
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const mediaFileRef = useRef(null);
  const dragCounter = useRef(0);

  const resetState = useCallback(() => {
    setMode("select");
    setAttachTo(context?.type || "lesson");
    setFile(null);
    setQuizData(null);
    setTitle("");
    setMediaFiles([]);
    setSpecificRequirements("");
    setNumberOfQuestions(15);
    setGenerating(false);
    setGeneratedResult(null);
    setSelectedPromptSlug("instant-quiz-generator");
    setError("");
    setSaving(false);
    setDragging(false);
    dragCounter.current = 0;
  }, [context?.type]);

  // Fetch prompts when entering generate mode
  useEffect(() => {
    if (mode !== "generate") return;
    let cancelled = false;
    getPrompts()
      .then((prompts) => {
        if (cancelled) return;
        setLessonPrompts(prompts.filter((p) => p.group_key === "lesson"));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [mode]);

  // ── Upload JSON handlers ──

  const handleJsonFile = useCallback((f) => {
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
        if (!result.valid) { setError(result.error); return; }
        setFile(f);
        setQuizData(data);
        setTitle(f.name.replace(/\.json$/i, "").replace(/[_-]/g, " "));
      } catch {
        setError("Invalid JSON file");
      }
    };
    reader.readAsText(f);
  }, []);

  const handleUploadSubmit = async () => {
    if (!title.trim()) { setError("Title is required"); return; }
    if (!quizData) { setError("Please upload a quiz file"); return; }
    setSaving(true);
    setError("");
    try {
      const payload = { title: title.trim(), quiz_data: quizData };
      if (attachTo === "lesson") payload.lesson_id = context.lessonId;
      else payload.week_id = context.weekId;
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

  // ── Generate handlers ──

  const handleMediaFiles = useCallback(async (files) => {
    setError("");
    const newFiles = [];
    for (const f of files) {
      const mt = f.type || inferMediaType(f.name);
      if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(mt)) {
        setError(`Unsupported file type: ${f.name}`);
        continue;
      }
      try {
        const data = await readFileAsBase64(f);
        newFiles.push(data);
      } catch {
        setError(`Failed to read: ${f.name}`);
      }
    }
    setMediaFiles((prev) => {
      const combined = [...prev, ...newFiles];
      if (combined.length > 10) {
        setError("Maximum 10 files allowed");
        return combined.slice(0, 10);
      }
      return combined;
    });
  }, []);

  // Ctrl+V paste support for images/PDFs in generate mode
  useEffect(() => {
    if (mode !== "generate" || generating) return;
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = [];
      for (const item of items) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        handleMediaFiles(files);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [mode, generating, handleMediaFiles]);

  const removeMediaFile = (index) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (mediaFiles.length === 0) { setError("Please upload at least one file"); return; }
    setGenerating(true);
    setError("");
    try {
      const media = mediaFiles.map((f) => ({
        base64: f.base64,
        mediaType: f.mediaType,
        fileName: f.name,
      }));
      const result = await generateInstantQuiz({
        media,
        specificRequirements,
        numberOfQuestions,
        lessonId: attachTo === "lesson" ? context.lessonId : undefined,
        weekId: attachTo === "week" ? context.weekId : undefined,
        promptSlug: selectedPromptSlug,
      });
      setGeneratedResult(result);
      setMode("success");
      onSuccess?.();
    } catch (e) {
      setError(e.message || "Quiz generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // ── Common ──

  const handleClose = () => { resetState(); onClose(); };

  if (!open) return null;

  const hasLesson = context?.lessonId && context?.lessonTitle;
  const hasWeek = context?.weekId && context?.weekTitle;
  const isGenerate = mode === "generate";

  // ── Attach To selector (shared) ──
  const attachToSelector = (
    <>
      {mode === "select" && (
        <label style={{
          display: "block", fontSize: 11, fontWeight: 800, color: C.muted,
          textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8,
        }}>
          Attach to
        </label>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: mode === "select" ? 20 : 0 }}>
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
    </>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: C.overlay, animation: "overlayFade 0.2s ease-out",
    }} onClick={handleClose}>
      <div className="slide-up" style={{
        background: C.card, borderRadius: 20, padding: isGenerate ? 28 : 32,
        width: "calc(100% - 48px)", maxWidth: isGenerate ? 800 : 480, minWidth: mode === "success" ? 0 : undefined,
        boxShadow: "0 8px 32px rgba(0,60,50,0.15)",
        maxHeight: "85vh", overflowY: "auto",
        transition: "max-width 0.25s ease",
      }} onClick={(e) => e.stopPropagation()}>

        {/* ═══════════ HEADER ═══════════ */}
        {mode !== "success" && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isGenerate ? 20 : 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {mode !== "select" && (
                <button onClick={() => { setMode("select"); setError(""); }} style={{
                  background: "none", border: "none", cursor: "pointer", color: C.muted,
                  padding: 4, display: "flex", transition: "color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
                onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>
                  {isGenerate ? "Generate quiz with AI" : "Add a Quiz"}
                </h3>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginTop: 4 }}>
                  {isGenerate
                    ? "Attach images and instructions — AI creates your quiz"
                    : "Attach a quiz to this lesson or unit"}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isGenerate && attachToSelector}
              <button onClick={handleClose} style={{
                background: "none", border: "none", cursor: "pointer", color: C.muted,
                padding: 4, display: "flex", transition: "color 0.15s", flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ SELECT MODE ═══════════ */}
        {mode === "select" && (
          <>
            {attachToSelector}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <button onClick={() => setMode("upload")} style={{
                padding: "20px 16px", borderRadius: 14,
                border: `2px solid ${C.border}`, background: "transparent",
                cursor: "pointer", textAlign: "center", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#8B5CF6"; e.currentTarget.style.background = "#EDE9FE"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "transparent"; }}>
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

              <button onClick={() => setMode("generate")} style={{
                padding: "20px 16px", borderRadius: 14,
                border: `2px solid ${C.border}`, background: "transparent",
                cursor: "pointer", textAlign: "center", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2d9d6a"; e.currentTarget.style.background = "#ECFDF5"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "transparent"; }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 10px",
                }}>
                  <span style={{ fontSize: 20 }}>✨</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Generate with AI</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>
                  Auto-create from lesson images or PDF
                </div>
              </button>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button onClick={handleClose} style={{
                flex: 1, padding: "14px", borderRadius: 14,
                border: `2px solid ${C.border}`, background: "transparent",
                color: C.text, fontWeight: 700, fontSize: 15,
                cursor: "pointer", fontFamily: "'Nunito', sans-serif", minHeight: 48,
              }}>Cancel</button>
            </div>
          </>
        )}

        {/* ═══════════ UPLOAD JSON MODE ═══════════ */}
        {mode === "upload" && (
          <>
            {!file && (
              <div
                onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setDragging(true); }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={(e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setDragging(false); } }}
                onDrop={(e) => { e.preventDefault(); dragCounter.current = 0; setDragging(false); handleJsonFile(e.dataTransfer?.files?.[0]); }}
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
                  onChange={(e) => handleJsonFile(e.target.files?.[0])} />
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Drop your quiz JSON here</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 4 }}>
                  or <span style={{ color: "#8B5CF6", fontWeight: 700 }}>click to browse</span> · .json files only
                </div>
              </div>
            )}

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
                  }}>{file.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>
                    {quizData?.questions?.length || 0} questions
                  </span>
                  <button onClick={() => { setFile(null); setQuizData(null); setTitle(""); setError(""); }} style={{
                    background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 2, display: "flex",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <label style={{
                  display: "block", fontSize: 11, fontWeight: 800, color: C.muted,
                  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6,
                }}>Quiz title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
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

            {error && (
              <p style={{ color: C.error, fontSize: 13, fontWeight: 600, textAlign: "center", marginBottom: 12 }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button onClick={() => { setMode("select"); setError(""); }} style={{
                flex: 1, padding: "14px", borderRadius: 14,
                border: `2px solid ${C.border}`, background: "transparent",
                color: C.text, fontWeight: 700, fontSize: 15,
                cursor: "pointer", fontFamily: "'Nunito', sans-serif", minHeight: 48,
              }}>Cancel</button>
              <button onClick={handleUploadSubmit} disabled={saving || !quizData} style={{
                flex: 1, padding: "14px", borderRadius: 14, border: "none",
                background: saving || !quizData ? "#C4B5FD" : "#8B5CF6",
                color: "white", fontWeight: 800, fontSize: 15,
                cursor: saving || !quizData ? "default" : "pointer",
                fontFamily: "'Nunito', sans-serif", minHeight: 48,
                transition: "background 0.15s",
              }}>{saving ? "Adding..." : "Add Quiz"}</button>
            </div>
          </>
        )}

        {/* ═══════════ GENERATE WITH AI MODE ═══════════ */}
        {isGenerate && (
          <>
            <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
              {/* ─── Left column: Source material ─── */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Source material</label>
                  {mediaFiles.length > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>
                      {mediaFiles.length} file{mediaFiles.length !== 1 ? "s" : ""} attached
                    </span>
                  )}
                </div>

                {/* Drop zone */}
                <div
                  onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setDragging(true); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setDragging(false); } }}
                  onDrop={(e) => {
                    e.preventDefault(); dragCounter.current = 0; setDragging(false);
                    handleMediaFiles(Array.from(e.dataTransfer?.files || []));
                  }}
                  onClick={() => mediaFileRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragging ? "#2d9d6a" : C.border}`,
                    borderRadius: 14, padding: "28px 16px", textAlign: "center",
                    cursor: "pointer", transition: "all 0.2s",
                    background: dragging ? "#ECFDF5" : "#FAFAF9",
                    marginBottom: mediaFiles.length > 0 ? 10 : 0,
                    opacity: generating ? 0.5 : 1,
                    pointerEvents: generating ? "none" : "auto",
                  }}
                >
                  <input ref={mediaFileRef} type="file" accept={ACCEPTED_MEDIA} multiple style={{ display: "none" }}
                    onChange={(e) => { handleMediaFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px", display: "block" }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Drop images here</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 4 }}>
                    or <span style={{ color: "#2d9d6a", fontWeight: 700 }}>click to browse</span> · paste from clipboard
                  </div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10 }}>
                    {["PNG", "JPG", "PDF", "WEBP"].map((t) => (
                      <span key={t} style={{
                        padding: "2px 8px", borderRadius: 6,
                        background: "#F0F0EE", fontSize: 11, fontWeight: 700, color: C.muted,
                      }}>{t}</span>
                    ))}
                  </div>
                </div>

                {/* File list */}
                {mediaFiles.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                    {mediaFiles.map((f, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                        background: f.mediaType === "application/pdf" ? "#FEF2F2" : "#FFFBEB",
                        borderRadius: 10, border: `1px solid ${f.mediaType === "application/pdf" ? "#FECACA" : "#FDE68A"}`,
                      }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{fileIcon(f.mediaType)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 700, color: C.text,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>{f.name}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>
                            {formatSize(f.size)} · {fileTypeLabel(f.mediaType)}
                          </div>
                        </div>
                        <button onClick={() => removeMediaFile(i)} disabled={generating} style={{
                          background: "none", border: "none", cursor: generating ? "default" : "pointer",
                          color: C.muted, padding: 2, display: "flex", flexShrink: 0,
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ─── Right column: Instructions ─── */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Instructions</label>
                  {lessonPrompts.length > 0 && (
                    <select
                      value={selectedPromptSlug}
                      onChange={(e) => setSelectedPromptSlug(e.target.value)}
                      disabled={generating}
                      style={{
                        padding: "4px 8px", borderRadius: 8,
                        border: `1.5px solid ${C.border}`, background: C.inputBg,
                        fontSize: 12, fontWeight: 700, color: C.text,
                        fontFamily: "'Nunito', sans-serif", cursor: "pointer",
                      }}
                    >
                      {lessonPrompts.map((p) => (
                        <option key={p.slug} value={p.slug}>{p.name || p.slug}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Requirements textarea */}
                <textarea
                  value={specificRequirements}
                  onChange={(e) => setSpecificRequirements(e.target.value)}
                  placeholder="Add any specific requirements, e.g. focus on vocabulary from page 2, only test grammar..."
                  disabled={generating}
                  style={{
                    width: "100%", minHeight: 160, padding: "12px 14px", borderRadius: 12,
                    border: `1.5px solid ${C.border}`, background: C.inputBg,
                    fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.6,
                    fontFamily: "'Nunito', sans-serif", outline: "none",
                    resize: "vertical", opacity: generating ? 0.5 : 1,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#2d9d6a")}
                  onBlur={(e) => (e.target.style.borderColor = C.border)}
                />

                <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 6, lineHeight: 1.4 }}>
                  Using base prompt: <strong>{selectedPromptSlug}.md</strong> — edit in Prompts manager.
                </p>

                {/* Number of questions */}
                <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Number of questions</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 0, marginLeft: "auto" }}>
                    <button onClick={() => setNumberOfQuestions((n) => Math.max(5, n - 5))} disabled={generating || numberOfQuestions <= 5}
                      style={{
                        width: 36, height: 36, borderRadius: "10px 0 0 10px",
                        border: `1.5px solid ${C.border}`, borderRight: "none", background: C.inputBg,
                        fontSize: 18, fontWeight: 700, color: C.text, cursor: "pointer",
                        fontFamily: "'Nunito', sans-serif", display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: generating || numberOfQuestions <= 5 ? 0.4 : 1,
                      }}>-</button>
                    <div style={{
                      width: 44, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                      border: `1.5px solid ${C.border}`, background: "white",
                      fontSize: 15, fontWeight: 800, color: C.text,
                    }}>{numberOfQuestions}</div>
                    <button onClick={() => setNumberOfQuestions((n) => Math.min(50, n + 5))} disabled={generating || numberOfQuestions >= 50}
                      style={{
                        width: 36, height: 36, borderRadius: "0 10px 10px 0",
                        border: `1.5px solid ${C.border}`, borderLeft: "none", background: C.inputBg,
                        fontSize: 18, fontWeight: 700, color: C.text, cursor: "pointer",
                        fontFamily: "'Nunito', sans-serif", display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: generating || numberOfQuestions >= 50 ? 0.4 : 1,
                      }}>+</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p style={{ color: C.error, fontSize: 13, fontWeight: 600, textAlign: "center", marginBottom: 12 }}>{error}</p>
            )}

            {/* Generating loading indicator */}
            {generating && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px 0", marginBottom: 8,
              }}>
                <div style={{
                  width: 16, height: 16, border: "2.5px solid #E5E7EB", borderTopColor: "#2d9d6a",
                  borderRadius: "50%", animation: "spin 0.8s linear infinite",
                }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>
                  Generating quiz... usually takes 15-30 seconds
                </span>
              </div>
            )}

            {/* Footer */}
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button onClick={() => { setMode("select"); setError(""); setMediaFiles([]); setSpecificRequirements(""); }}
                disabled={generating}
                style={{
                  flex: 1, padding: "14px", borderRadius: 14,
                  border: `2px solid ${C.border}`, background: "transparent",
                  color: C.text, fontWeight: 700, fontSize: 15,
                  cursor: generating ? "default" : "pointer",
                  fontFamily: "'Nunito', sans-serif", minHeight: 48,
                  opacity: generating ? 0.5 : 1,
                }}>Cancel</button>
              <button onClick={handleGenerate} disabled={generating || mediaFiles.length === 0}
                style={{
                  flex: 1, padding: "14px", borderRadius: 14, border: "none",
                  background: generating || mediaFiles.length === 0 ? "#86EFAC" : "#2d9d6a",
                  color: "white", fontWeight: 800, fontSize: 15,
                  cursor: generating || mediaFiles.length === 0 ? "default" : "pointer",
                  fontFamily: "'Nunito', sans-serif", minHeight: 48,
                  transition: "background 0.15s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                {generating ? (
                  "Generating..."
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    Generate quiz
                  </>
                )}
              </button>
            </div>

            {/* Spinner animation */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        )}

        {/* ═══════════ SUCCESS MODE ═══════════ */}
        {mode === "success" && generatedResult && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2d9d6a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 6 }}>
              Quiz generated!
            </h3>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.muted, marginBottom: 4 }}>
              {generatedResult.title}
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 28 }}>
              {generatedResult.questionCount} questions created
            </p>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => { resetState(); onClose(); }} style={{
                flex: 1, padding: "14px", borderRadius: 14,
                border: `2px solid ${C.border}`, background: "transparent",
                color: C.text, fontWeight: 700, fontSize: 15,
                cursor: "pointer", fontFamily: "'Nunito', sans-serif", minHeight: 48,
              }}>Close</button>
              <button onClick={() => {
                const quizId = generatedResult.quizId;
                resetState();
                onClose();
                navigate(`/quiz/${quizId}?q=1`);
              }} style={{
                flex: 1, padding: "14px", borderRadius: 14, border: "none",
                background: "#2d9d6a", color: "white", fontWeight: 800, fontSize: 15,
                cursor: "pointer", fontFamily: "'Nunito', sans-serif", minHeight: 48,
                transition: "background 0.15s",
              }}>Go to quiz</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
