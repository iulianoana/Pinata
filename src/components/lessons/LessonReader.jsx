import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { C } from "../../styles/theme";
import PdfSection from "./PdfSection";
import useLessonPdf from "../../useLessonPdf";
import QuizMiniCard from "../quizzes/QuizMiniCard";
import AddQuizModal from "../quizzes/AddQuizModal";
import AddQuizSheet from "../AddQuizSheet";
import LessonLinks from "./LessonLinks";
import { fetchQuizzes, updateLesson } from "../../lib/api";
import { relativeTime } from "../../utils/helpers";

const mdComponents = {
  h1: ({ children }) => (
    <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: "24px 0 12px", lineHeight: 1.3 }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: "20px 0 8px", lineHeight: 1.4 }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: 17, fontWeight: 800, color: C.accentHover, margin: "16px 0 6px", lineHeight: 1.4 }}>{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 style={{ fontSize: 15, fontWeight: 800, color: C.accentHover, margin: "12px 0 4px" }}>{children}</h4>
  ),
  p: ({ children }) => (
    <p style={{ fontSize: 15, color: "#3A5A52", lineHeight: 1.7, margin: "8px 0", fontWeight: 600 }}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul style={{ paddingLeft: 20, margin: "8px 0", fontSize: 15, color: "#3A5A52", lineHeight: 1.7, fontWeight: 600 }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ paddingLeft: 20, margin: "8px 0", fontSize: 15, color: "#3A5A52", lineHeight: 1.7, fontWeight: 600 }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ marginBottom: 4 }}>{children}</li>
  ),
  code: ({ inline, children }) => {
    if (inline) {
      return (
        <code style={{
          background: C.accentLight, color: C.accentHover, padding: "2px 6px",
          borderRadius: 6, fontSize: 14, fontFamily: "monospace", fontWeight: 700,
        }}>{children}</code>
      );
    }
    return (
      <pre style={{
        background: "#F0FAF8", padding: 16, borderRadius: 12, overflowX: "auto",
        margin: "12px 0", border: `1px solid ${C.border}`,
      }}>
        <code style={{ fontSize: 14, fontFamily: "monospace", color: C.text, lineHeight: 1.6 }}>{children}</code>
      </pre>
    );
  },
  blockquote: ({ children }) => (
    <blockquote style={{
      borderLeft: `3px solid ${C.accent}`, background: "#F0FAF8",
      padding: "10px 14px", margin: "12px 0", borderRadius: "0 8px 8px 0",
    }}>{children}</blockquote>
  ),
  table: ({ children }) => (
    <div style={{ overflowX: "auto", margin: "12px 0" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 15, fontWeight: 600 }}>{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{
      padding: "8px 12px", borderBottom: `2px solid ${C.accent}`, textAlign: "left",
      fontWeight: 800, color: C.text, fontSize: 14,
    }}>{children}</th>
  ),
  td: ({ children }) => (
    <td style={{
      padding: "8px 12px", borderBottom: `1px solid ${C.border}`, color: "#3A5A52",
    }}>{children}</td>
  ),
  hr: () => (
    <hr style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "20px 0" }} />
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 800, color: C.text }}>{children}</strong>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: C.accent, fontWeight: 700, textDecoration: "none" }}>{children}</a>
  ),
};

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PANEL_STORAGE_KEY = "pinata-pdf-panel-width";
const DEFAULT_PANEL_PCT = 50; // % of usable content area
const MIN_PANEL_W = 300;
const MAX_PANEL_PCT = 70;

function getSavedPanelWidth() {
  try { const v = localStorage.getItem(PANEL_STORAGE_KEY); return v ? Number(v) : null; } catch { return null; }
}

export default function LessonReader({ lesson, weekContext, week, onBack }) {
  const navigate = useNavigate();
  const { pdfInfo, isLoading: pdfLoading, uploadProgress, uploadPhase, uploadPdf, viewPdf, deletePdf } = useLessonPdf(lesson.id);
  const [pdfPanelOpen, setPdfPanelOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [loadingPdfView, setLoadingPdfView] = useState(false);
  const [panelWidth, setPanelWidth] = useState(() => getSavedPanelWidth());
  const [isResizing, setIsResizing] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const bodyRef = useRef(null);
  const panelWidthRef = useRef(panelWidth);

  // Panel upload state
  const panelFileRef = useRef(null);
  const [panelDragging, setPanelDragging] = useState(false);
  const [panelDeleting, setPanelDeleting] = useState(false);
  const [panelTab, setPanelTab] = useState("pdf"); // "pdf" | "quizzes"

  // Title editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(lesson.title);
  const [titleSaving, setTitleSaving] = useState(false);
  const titleInputRef = useRef(null);
  const lastTapRef = useRef(0);

  const handleTitleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      startEditTitle();
    }
    lastTapRef.current = now;
  };

  const startEditTitle = () => {
    setTitleDraft(lesson.title);
    setEditingTitle(true);
  };

  const cancelEditTitle = () => {
    setEditingTitle(false);
    setTitleDraft(lesson.title);
  };

  const saveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === lesson.title) { cancelEditTitle(); return; }
    setTitleSaving(true);
    try {
      await updateLesson(lesson.id, { title: trimmed });
      lesson.title = trimmed;
      setEditingTitle(false);
    } catch (e) {
      console.error("Failed to update title:", e);
    } finally {
      setTitleSaving(false);
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); saveTitle(); }
    if (e.key === "Escape") cancelEditTitle();
  };

  useEffect(() => {
    if (editingTitle && titleInputRef.current) titleInputRef.current.focus();
  }, [editingTitle]);

  // Quiz state
  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [showAddQuizModal, setShowAddQuizModal] = useState(false); // desktop
  const [showAddQuizSheet, setShowAddQuizSheet] = useState(false); // mobile

  useEffect(() => { panelWidthRef.current = panelWidth; }, [panelWidth]);

  // Fetch quizzes for this lesson
  const loadQuizzes = useCallback(async () => {
    try {
      const data = await fetchQuizzes({ lesson_id: lesson.id });
      setQuizzes(data);
    } catch (e) {
      console.error("Failed to load quizzes:", e);
    } finally {
      setQuizzesLoading(false);
    }
  }, [lesson.id]);

  useEffect(() => { loadQuizzes(); }, [loadQuizzes]);

  // Aggregated quiz stats
  const quizStats = useMemo(() => {
    if (quizzes.length === 0) return null;
    const attempted = quizzes.filter((q) => q.attempt_count > 0);
    if (attempted.length === 0) return { bestScore: null, avgScore: null, totalAttempts: 0, lastPracticed: null };
    const bestScore = Math.max(...attempted.map((q) => q.best_score));
    const avgScore = Math.round(attempted.reduce((s, q) => s + (q.avg_score || 0), 0) / attempted.length);
    const totalAttempts = attempted.reduce((s, q) => s + q.attempt_count, 0);
    const lastPracticed = attempted.reduce((latest, q) =>
      q.last_attempted_at && (!latest || q.last_attempted_at > latest) ? q.last_attempted_at : latest
    , null);
    return { bestScore, avgScore, totalAttempts, lastPracticed };
  }, [quizzes]);

  // Compute effective panel width (px). Default to ~50% of body.
  const getEffectiveWidth = useCallback(() => {
    if (panelWidthRef.current) return panelWidthRef.current;
    const bodyW = bodyRef.current?.offsetWidth;
    if (bodyW) return Math.max(MIN_PANEL_W, Math.round(bodyW * DEFAULT_PANEL_PCT / 100));
    return 600;
  }, []);

  // Resize drag handlers
  const onResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const startX = e.clientX;
    const startW = getEffectiveWidth();

    const onMove = (ev) => {
      const bodyW = bodyRef.current?.offsetWidth || 1;
      let newW = startW + (startX - ev.clientX);
      newW = Math.max(MIN_PANEL_W, Math.min(newW, bodyW * MAX_PANEL_PCT / 100));
      setPanelWidth(Math.round(newW));
    };

    const onUp = () => {
      setIsResizing(false);
      setIframeKey((k) => k + 1); // force iframe remount so PDF viewer recalculates zoom
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      try { localStorage.setItem(PANEL_STORAGE_KEY, String(panelWidthRef.current)); } catch {}
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [getEffectiveWidth]);

  // Auto-load PDF into iframe when panel opens and PDF exists
  useEffect(() => {
    if (pdfPanelOpen && pdfInfo && !pdfBlobUrl) {
      setLoadingPdfView(true);
      viewPdf()
        .then((blob) => {
          if (blob) setPdfBlobUrl(URL.createObjectURL(blob));
        })
        .catch(() => {})
        .finally(() => setLoadingPdfView(false));
    }
  }, [pdfPanelOpen, pdfInfo?.name]);

  // Clear blob URL when PDF is deleted
  useEffect(() => {
    if (!pdfInfo && pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
  }, [pdfInfo]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, []);

  const handlePanelFile = useCallback((file) => {
    if (!file) return;
    if (file.type !== "application/pdf") { alert("Only PDF files are allowed."); return; }
    if (file.size > 200 * 1024 * 1024) { alert("File too large (max 200 MB)."); return; }
    uploadPdf(file);
  }, [uploadPdf]);

  const handlePanelDrop = useCallback((e) => {
    e.preventDefault();
    setPanelDragging(false);
    handlePanelFile(e.dataTransfer?.files?.[0]);
  }, [handlePanelFile]);

  const handlePanelDelete = async () => {
    if (!confirm("Remove PDF from this lesson?")) return;
    setPanelDeleting(true);
    try {
      await deletePdf();
      if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }
    } finally {
      setPanelDeleting(false);
    }
  };

  const handleQuizAdded = () => {
    setQuizzesLoading(true);
    loadQuizzes();
  };

  const handleSelectQuiz = (quiz) => {
    navigate(`/quiz/${quiz.id}?q=1`, { state: { from: "lesson", lessonId: lesson.id } });
  };

  const addQuizContext = useMemo(() => ({
    type: "lesson",
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    weekId: week?.id || null,
    weekTitle: week ? `Unit #${week.week_number}: ${week.title || `Week ${week.week_number}`}` : null,
  }), [lesson.id, lesson.title, week]);

  // Quiz sidebar content (shared between desktop sidebar and mobile section)
  const renderQuizList = (compact = false) => (
    <>
      {quizzesLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="skeleton" style={{ height: 60, borderRadius: 12 }} />
          <div className="skeleton" style={{ height: 60, borderRadius: 12 }} />
        </div>
      ) : quizzes.length === 0 ? (
        <p style={{ color: C.muted, fontSize: 13, fontWeight: 600, textAlign: "center", padding: "12px 0" }}>
          No quizzes yet
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {quizzes.map((q) => (
            <QuizMiniCard key={q.id} quiz={q} onClick={() => handleSelectQuiz(q)} />
          ))}
        </div>
      )}

      {/* Add quiz button */}
      <button
        className={compact ? "add-quiz-btn-mobile-inline" : ""}
        onClick={() => {
          if (compact) setShowAddQuizSheet(true);
          else setShowAddQuizModal(true);
        }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          width: "100%", padding: compact ? "10px" : "12px", borderRadius: 12,
          border: "2px dashed #8B5CF6", background: "transparent",
          color: "#8B5CF6", fontWeight: 700, fontSize: 13,
          cursor: "pointer", fontFamily: "'Nunito', sans-serif",
          transition: "all 0.15s", marginTop: 8,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#EDE9FE")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        + Add quiz
      </button>
    </>
  );

  // Lesson Progress card
  const renderProgressCard = () => {
    if (!quizStats || quizStats.bestScore === null) return null;
    return (
      <div style={{
        background: C.card, borderRadius: 14, padding: 20,
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 16 }}>📊</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Lesson Progress</span>
        </div>

        {/* Big score */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 42, fontWeight: 900, color: C.accent, lineHeight: 1 }}>
            {quizStats.bestScore}%
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 4 }}>Best quiz score</div>
        </div>

        {/* Stats rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
            <span style={{ color: C.muted }}>Attempts</span>
            <span style={{ color: C.text, fontWeight: 700 }}>{quizStats.totalAttempts}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
            <span style={{ color: C.muted }}>Average</span>
            <span style={{ color: C.text, fontWeight: 700 }}>{quizStats.avgScore}%</span>
          </div>
          {quizStats.lastPracticed && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: C.muted }}>Last practiced</span>
              <span style={{ color: C.text, fontWeight: 700 }}>{relativeTime(new Date(quizStats.lastPracticed).getTime())}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const phaseLabels = { token: "Preparing...", uploading: "Uploading...", compressing: "Compressing PDF...", saving: "Saving..." };

  const renderPanelContent = () => {
    // Uploading
    if (uploadProgress !== null) {
      const isIndeterminate = uploadPhase === "compressing" || uploadPhase === "saving" || uploadPhase === "token";
      return (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            {phaseLabels[uploadPhase] || "Uploading..."}{!isIndeterminate ? ` ${uploadProgress}%` : ""}
          </div>
          <div style={{ background: C.border, borderRadius: 4, height: 6, overflow: "hidden" }}>
            {isIndeterminate ? (
              <div className="progress-indeterminate" style={{ background: C.accent, height: "100%", width: "40%", borderRadius: 4 }} />
            ) : (
              <div style={{ background: C.accent, height: "100%", width: `${uploadProgress}%`, borderRadius: 4, transition: "width 0.2s" }} />
            )}
          </div>
          {isIndeterminate && (
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 6 }}>
              This may take a minute for large files
            </div>
          )}
        </div>
      );
    }

    // Loading initial state
    if (pdfLoading) {
      return <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />;
    }

    // PDF attached — iframe only (file info is in the header strip)
    if (pdfInfo) {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {loadingPdfView ? (
            <div className="skeleton" style={{ flex: 1, borderRadius: 12, minHeight: 300 }} />
          ) : pdfBlobUrl ? (
            <iframe
              key={iframeKey}
              src={pdfBlobUrl + "#navpanes=0"}
              title="Course PDF"
              style={{
                flex: 1, width: "100%", border: `1px solid ${C.border}`,
                borderRadius: 12, minHeight: 300,
                pointerEvents: isResizing ? "none" : "auto",
              }}
            />
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13, fontWeight: 600 }}>
              Could not load PDF
            </div>
          )}
        </div>
      );
    }

    // No PDF — upload drop zone
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setPanelDragging(true); }}
        onDragLeave={() => setPanelDragging(false)}
        onDrop={handlePanelDrop}
        onClick={() => panelFileRef.current?.click()}
        style={{
          border: `2px dashed ${panelDragging ? C.accent : C.border}`,
          borderRadius: 12, padding: "40px 16px", textAlign: "center",
          cursor: "pointer", transition: "all 0.2s",
          background: panelDragging ? C.accentLight : "transparent",
        }}
      >
        <input ref={panelFileRef} type="file" accept="application/pdf" style={{ display: "none" }}
          onChange={(e) => handlePanelFile(e.target.files?.[0])} />
        <div style={{
          width: 48, height: 48, borderRadius: "50%", background: C.accentLight,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 12px",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
          Drop your PDF here
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 4 }}>
          or click to browse · max 10MB
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 2 }}>
          Larger files will be auto-compressed
        </div>
      </div>
    );
  };

  return (
    <div className="lesson-reader-root" style={{ minHeight: "100vh", background: C.card }}>
      {/* Desktop header — matches quiz-screen pattern */}
      <div className="quiz-desktop-header" style={{
        display: "none", alignItems: "center", gap: 12,
        padding: "16px 40px 12px",
      }}>
        <button onClick={onBack} style={{
          background: "none", border: `1.5px solid ${C.border}`, borderRadius: 10,
          color: C.muted, cursor: "pointer", padding: "6px 8px",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; e.currentTarget.style.borderColor = C.accent; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lesson.title}
        </span>

        {/* Course PDF / Attach PDF button */}
        <button
          onClick={() => setPdfPanelOpen((prev) => !prev)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 10,
            border: `1.5px solid ${C.border}`, background: "none",
            color: C.text, fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "'Nunito', sans-serif",
            transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text; }}
        >
          {pdfLoading || pdfInfo ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
          {pdfLoading || pdfInfo ? "Course PDF" : "Attach PDF"}
        </button>
      </div>

      {/* Body: content + quiz sidebar + PDF panel */}
      <div className="lesson-reader-body" ref={bodyRef}>
        {/* Main scrollable content */}
        <div className="lesson-reader-scroll">
          <div className={`app-container lesson-reader-container ${pdfPanelOpen ? "lesson-reader-panel-open" : ""}`} style={{ padding: "0 20px 60px" }}>
            {/* Mobile back button — hidden on desktop */}
            <button className="quiz-home-btn" onClick={onBack} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "none", border: "none", color: C.accent, fontWeight: 700,
              fontSize: 14, cursor: "pointer", fontFamily: "'Nunito', sans-serif",
              padding: "16px 0",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back to lessons
            </button>

            {/* Title */}
            {editingTitle ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <input
                  ref={titleInputRef}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  disabled={titleSaving}
                  style={{
                    flex: 1, fontSize: 24, fontWeight: 900, color: C.text, lineHeight: 1.3,
                    fontFamily: "'Nunito', sans-serif",
                    border: `1.5px solid ${C.accent}`, borderRadius: 8,
                    padding: "4px 10px", outline: "none", background: "#F8FFFE",
                    opacity: titleSaving ? 0.6 : 1,
                  }}
                />
                {/* Save */}
                <button onClick={saveTitle} disabled={titleSaving} style={{
                  background: "none", border: "none", cursor: "pointer", padding: 4,
                  color: C.accent, display: "flex", alignItems: "center",
                  opacity: titleSaving ? 0.4 : 1,
                }}
                title="Save"
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = titleSaving ? "0.4" : "1")}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
                {/* Cancel */}
                <button onClick={cancelEditTitle} disabled={titleSaving} style={{
                  background: "none", border: "none", cursor: "pointer", padding: 4,
                  color: C.muted, display: "flex", alignItems: "center",
                }}
                title="Cancel"
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.6")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              <div
                className="lesson-title-row"
                style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}
                onTouchEnd={handleTitleDoubleTap}
              >
                <h1 style={{ fontSize: 24, fontWeight: 900, color: C.text, lineHeight: 1.3, margin: 0 }}>
                  {lesson.title}
                </h1>
                <button className="lesson-title-edit-btn" onClick={startEditTitle} style={{
                  background: "none", border: "none", cursor: "pointer", padding: 4,
                  color: C.muted, display: "flex", alignItems: "center", flexShrink: 0,
                  opacity: 0, transition: "opacity 0.15s",
                }}
                title="Edit title"
                onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </button>
              </div>
            )}

            {/* Context line */}
            {weekContext && (
              <p style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 16 }}>
                {weekContext}
              </p>
            )}

            {/* Divider */}
            <div style={{ borderTop: `1px solid ${C.border}`, marginBottom: 24 }} />

            {/* PDF Section — mobile only (hidden on desktop via CSS) */}
            <div className="pdf-section-inline" style={{ marginBottom: 24 }}>
              <PdfSection
                pdfInfo={pdfInfo}
                isLoading={pdfLoading}
                uploadProgress={uploadProgress}
                uploadPhase={uploadPhase}
                onUpload={uploadPdf}
                onView={viewPdf}
                onDelete={deletePdf}
              />
            </div>

            {/* Quiz Section — mobile only (hidden on desktop via CSS) */}
            <div className="quiz-section-mobile" style={{ marginBottom: 24 }}>
              <div style={{
                background: C.card, borderRadius: 16, padding: 20,
                border: `1px solid ${C.border}`,
              }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🧩</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Quizzes</span>
                  </div>
                  {!quizzesLoading && quizzes.length > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>
                      {quizzes.length} quiz{quizzes.length !== 1 ? "zes" : ""}
                    </span>
                  )}
                </div>
                {renderQuizList(true)}
              </div>
              {/* Links card — mobile */}
              <div style={{ marginTop: 16 }}>
                <LessonLinks lessonId={lesson.id} />
              </div>
            </div>

            {/* Markdown body */}
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {lesson.markdown_content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Desktop Quiz sidebar — hidden when PDF panel is open */}
        {!pdfPanelOpen && (
          <div className="quiz-sidebar-desktop" style={{ display: "none" }}>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Quizzes card */}
              <div style={{
                background: C.card, borderRadius: 14, padding: 20,
                border: `1px solid ${C.border}`,
              }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🧩</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Quizzes</span>
                  </div>
                  {!quizzesLoading && quizzes.length > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>
                      {quizzes.length} quiz{quizzes.length !== 1 ? "zes" : ""}
                    </span>
                  )}
                </div>
                {renderQuizList(false)}
              </div>

              {/* Links card — desktop sidebar */}
              <LessonLinks lessonId={lesson.id} />

              {/* Lesson Progress card */}
              {renderProgressCard()}
            </div>
          </div>
        )}

        {/* Desktop PDF side panel */}
        <div className="pdf-side-panel-desktop" style={{
          width: pdfPanelOpen ? getEffectiveWidth() : 0,
          overflow: "hidden",
          transition: isResizing ? "none" : "width 0.3s ease",
          position: "relative",
        }}>
          {/* Resize drag handle */}
          {pdfPanelOpen && (
            <div
              onMouseDown={onResizeStart}
              style={{
                position: "absolute", left: 0, top: 0, bottom: 0, width: 6,
                cursor: "col-resize", zIndex: 5,
                background: "transparent",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.border)}
              onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.background = "transparent"; }}
            />
          )}
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0,
            width: getEffectiveWidth(), display: "flex", flexDirection: "column",
            borderLeft: `1px solid ${C.border}`, background: C.card,
          }}>
            {/* Panel header — single row: tabs + file info + close */}
            <div style={{
              display: "flex", alignItems: "center", padding: "10px 12px",
              borderBottom: `1px solid ${C.border}`, flexShrink: 0, gap: 4,
            }}>
              {/* Tabs */}
              <button onClick={() => setPanelTab("pdf")} style={{
                background: "none", border: "none",
                borderBottom: panelTab === "pdf" ? `2px solid ${C.text}` : "2px solid transparent",
                padding: "4px 8px", fontSize: 13,
                fontWeight: panelTab === "pdf" ? 800 : 600,
                color: panelTab === "pdf" ? C.text : C.muted,
                cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                flexShrink: 0, transition: "all 0.15s",
              }}>Course PDF</button>
              <button onClick={() => setPanelTab("quizzes")} style={{
                background: "none", border: "none",
                borderBottom: panelTab === "quizzes" ? `2px solid #8B5CF6` : "2px solid transparent",
                padding: "4px 8px", fontSize: 13,
                fontWeight: panelTab === "quizzes" ? 800 : 600,
                color: panelTab === "quizzes" ? "#8B5CF6" : C.muted,
                cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                flexShrink: 0, transition: "all 0.15s",
              }}>Quizzes</button>

              {/* File info — inline after tabs, only when PDF attached and on PDF tab */}
              {panelTab === "pdf" && pdfInfo && uploadProgress === null && !pdfLoading ? (
                <>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.error} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pdfInfo.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, flexShrink: 0 }}>
                    {formatSize(pdfInfo.size)}
                  </span>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                    background: pdfInfo.isCached ? C.success : C.muted,
                  }} title={pdfInfo.isCached ? "Available offline" : "Cloud only"} />
                  <button onClick={handlePanelDelete} disabled={panelDeleting} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: C.muted, padding: 2, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    transition: "color 0.15s", flexShrink: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = C.error)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </>
              ) : (
                <div style={{ flex: 1 }} />
              )}

              {/* Close */}
              <button onClick={() => setPdfPanelOpen(false)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: C.muted, padding: 2, display: "flex",
                alignItems: "center", justifyContent: "center",
                transition: "color 0.15s", flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Panel body */}
            {panelTab === "pdf" ? (
              <div style={{ flex: 1, padding: pdfInfo && !pdfLoading && uploadProgress === null ? "8px 8px" : "20px 20px", overflowY: "auto" }}>
                {renderPanelContent()}
              </div>
            ) : (
              <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Quizzes card */}
                  <div style={{
                    background: C.card, borderRadius: 14, padding: 20,
                    border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>🧩</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Quizzes</span>
                      </div>
                      {!quizzesLoading && quizzes.length > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>
                          {quizzes.length} quiz{quizzes.length !== 1 ? "zes" : ""}
                        </span>
                      )}
                    </div>
                    {renderQuizList(false)}
                  </div>
                  {/* Links card — PDF panel quizzes tab */}
                  <LessonLinks lessonId={lesson.id} />
                  {renderProgressCard()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Add Quiz Modal */}
      <AddQuizModal
        open={showAddQuizModal}
        onClose={() => setShowAddQuizModal(false)}
        onSuccess={handleQuizAdded}
        context={addQuizContext}
      />

      {/* Mobile Add Quiz Sheet */}
      <AddQuizSheet
        open={showAddQuizSheet}
        onClose={() => setShowAddQuizSheet(false)}
        context={addQuizContext}
        onSuccess={handleQuizAdded}
      />
    </div>
  );
}
