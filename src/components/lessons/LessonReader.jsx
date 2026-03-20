import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { C } from "../../styles/theme";

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

export default function LessonReader({ lesson, weekContext, onBack }) {
  return (
    <div className="fade-in" style={{ minHeight: "100vh", background: C.bg }}>
      {/* Mobile: full-screen overlay. Desktop: content area replacement. */}
      <div className="lesson-reader-container" style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 60px" }}>
        {/* Back button */}
        <button onClick={onBack} style={{
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

        {/* Markdown body */}
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {lesson.markdown_content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
