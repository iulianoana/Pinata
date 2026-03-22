import { useState, useEffect, useRef } from "react";
import { C } from "../../styles/theme";

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MobilePdfViewer({ blob, fileName, fileSize, isCached, onClose }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rendered, setRendered] = useState(0);
  const [total, setTotal] = useState(0);
  const pdfDocRef = useRef(null);

  useEffect(() => {
    if (!blob) return;
    let cancelled = false;

    async function renderPdf() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const arrayBuffer = await blob.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        if (cancelled) { pdfDoc.destroy(); return; }

        pdfDocRef.current = pdfDoc;
        setTotal(pdfDoc.numPages);

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        const containerWidth = container.clientWidth || window.innerWidth;
        const dpr = window.devicePixelRatio || 1;

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          if (cancelled) break;
          const page = await pdfDoc.getPage(i);

          const viewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / viewport.width;
          const scaledViewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(scaledViewport.width * dpr);
          canvas.height = Math.floor(scaledViewport.height * dpr);
          canvas.style.width = `${Math.floor(scaledViewport.width)}px`;
          canvas.style.height = `${Math.floor(scaledViewport.height)}px`;
          canvas.style.display = "block";

          const ctx = canvas.getContext("2d");
          ctx.scale(dpr, dpr);

          await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

          container.appendChild(canvas);
          setRendered(i);

          if (i === 1) setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("PDF render error:", err);
          setError(err.message || "Failed to render PDF");
          setLoading(false);
        }
      }
    }

    renderPdf();

    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [blob]);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: C.card, zIndex: 9999,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 16px",
        paddingTop: "max(12px, env(safe-area-inset-top, 12px))",
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0, background: C.card, zIndex: 2,
      }}>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: C.accent,
          fontWeight: 700, fontSize: 14, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 4,
          fontFamily: "'Nunito', sans-serif", padding: 0, flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Lesson
        </button>

        <div style={{ flex: 1, textAlign: "center", overflow: "hidden", minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: C.text,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {fileName}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: C.muted,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            marginTop: 1,
          }}>
            {isCached && (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>Available offline</span>
              </>
            )}
            {fileSize ? (
              <span>{isCached ? " \u00B7 " : ""}{formatSize(fileSize)}</span>
            ) : null}
          </div>
        </div>

        <div style={{ width: 50, flexShrink: 0 }} />
      </div>

      {/* Page progress indicator */}
      {!loading && total > 0 && rendered < total && (
        <div style={{
          padding: "6px 16px", background: C.accentLight, textAlign: "center",
          fontSize: 12, fontWeight: 700, color: C.accent, flexShrink: 0,
        }}>
          Rendering pages... {rendered}/{total}
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)", zIndex: 3,
        }}>
          <div className="skeleton" style={{ width: 200, height: 280, borderRadius: 8 }} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 32, textAlign: "center",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.error, marginBottom: 8 }}>
              Failed to load PDF
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>{error}</div>
          </div>
        </div>
      )}

      {/* Scrollable PDF pages */}
      <div
        ref={containerRef}
        style={{
          flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch",
          background: "#e8e8e8",
          opacity: loading ? 0 : 1,
          transition: "opacity 0.2s",
        }}
      />
    </div>
  );
}
