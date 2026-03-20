import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { C } from "../../styles/theme";
import PdfSection from "./PdfSection";
import useLessonPdf from "../../useLessonPdf";

const mdComponents = {
  h1: ({ children }) => (
    <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "24px 0 12px", lineHeight: 1.3 }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "20px 0 8px", lineHeight: 1.4 }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: 14, fontWeight: 800, color: C.accentHover, margin: "16px 0 6px", lineHeight: 1.4 }}>{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 style={{ fontSize: 13, fontWeight: 800, color: C.accentHover, margin: "12px 0 4px" }}>{children}</h4>
  ),
  p: ({ children }) => (
    <p style={{ fontSize: 13, color: "#3A5A52", lineHeight: 1.7, margin: "8px 0", fontWeight: 600 }}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul style={{ paddingLeft: 20, margin: "8px 0", fontSize: 13, color: "#3A5A52", lineHeight: 1.7, fontWeight: 600 }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ paddingLeft: 20, margin: "8px 0", fontSize: 13, color: "#3A5A52", lineHeight: 1.7, fontWeight: 600 }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ marginBottom: 4 }}>{children}</li>
  ),
  code: ({ inline, children }) => {
    if (inline) {
      return (
        <code style={{
          background: C.accentLight, color: C.accentHover, padding: "2px 6px",
          borderRadius: 6, fontSize: 12, fontFamily: "monospace", fontWeight: 700,
        }}>{children}</code>
      );
    }
    return (
      <pre style={{
        background: "#F0FAF8", padding: 16, borderRadius: 12, overflowX: "auto",
        margin: "12px 0", border: `1px solid ${C.border}`,
      }}>
        <code style={{ fontSize: 12, fontFamily: "monospace", color: C.text, lineHeight: 1.6 }}>{children}</code>
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
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, fontWeight: 600 }}>{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{
      padding: "8px 12px", borderBottom: `2px solid ${C.accent}`, textAlign: "left",
      fontWeight: 800, color: C.text, fontSize: 12,
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

export default function LessonReader({ lesson, weekContext, onBack }) {
  const { pdfInfo, isLoading: pdfLoading, uploadProgress, uploadPdf, viewPdf, deletePdf } = useLessonPdf(lesson.id);
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

  useEffect(() => { panelWidthRef.current = panelWidth; }, [panelWidth]);

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
    if (file.size > 10 * 1024 * 1024) { alert("File too large (max 10 MB)."); return; }
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

  const renderPanelContent = () => {
    // Uploading
    if (uploadProgress !== null) {
      return (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            Uploading... {uploadProgress}%
          </div>
          <div style={{ background: C.border, borderRadius: 4, height: 6, overflow: "hidden" }}>
            <div style={{ background: C.accent, height: "100%", width: `${uploadProgress}%`, borderRadius: 4, transition: "width 0.2s" }} />
          </div>
        </div>
      );
    }

    // Loading initial state
    if (pdfLoading) {
      return <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />;
    }

    // PDF attached — show file info + iframe
    if (pdfInfo) {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* File info card */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: 12,
            background: C.errorLight, borderRadius: 12, marginBottom: 12, flexShrink: 0,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, display: "flex",
              alignItems: "center", justifyContent: "center", background: "#FFD4DC",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.error} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {pdfInfo.name}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                {formatSize(pdfInfo.size)}
                <span style={{ color: pdfInfo.isCached ? C.success : C.muted, fontWeight: 700 }}>
                  {pdfInfo.isCached ? "Available offline" : "Cloud only"}
                </span>
              </div>
            </div>
            <button onClick={handlePanelDelete} disabled={panelDeleting} style={{
              background: "none", border: "none", cursor: "pointer",
              color: C.muted, padding: 4, display: "flex",
              alignItems: "center", justifyContent: "center",
              transition: "color 0.15s", flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.error)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>

          {/* PDF iframe or loading */}
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

      {/* Body: content + panel side by side */}
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
            <h1 style={{ fontSize: 24, fontWeight: 900, color: C.text, lineHeight: 1.3, marginBottom: 8 }}>
              {lesson.title}
            </h1>

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
                onUpload={uploadPdf}
                onView={viewPdf}
                onDelete={deletePdf}
              />
            </div>

            {/* Markdown body */}
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {lesson.markdown_content}
            </ReactMarkdown>
          </div>
        </div>

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
            {/* Panel header — tabs + close */}
            <div style={{
              display: "flex", alignItems: "center", padding: "16px 20px 0",
            }}>
              <div style={{ display: "flex", flex: 1 }}>
                <button style={{
                  background: "none", border: "none", borderBottom: `2px solid ${C.text}`,
                  padding: "8px 16px", fontSize: 14, fontWeight: 800,
                  color: C.text, cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                }}>Course PDF</button>
                <button style={{
                  background: "none", border: "none", borderBottom: "2px solid transparent",
                  padding: "8px 16px", fontSize: 14, fontWeight: 600,
                  color: C.muted, cursor: "default", fontFamily: "'Nunito', sans-serif",
                  opacity: 0.5,
                }}>My Notes</button>
              </div>
              <button onClick={() => setPdfPanelOpen(false)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: C.muted, padding: 4, display: "flex",
                alignItems: "center", justifyContent: "center",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Panel body */}
            <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
              {renderPanelContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
