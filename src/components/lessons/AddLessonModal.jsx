import { useState, useRef } from "react";
import { C } from "../../styles/theme";

export default function AddLessonModal({ open, onClose, onCreate, weekLabel }) {
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const handleFile = (file) => {
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      setMarkdown(e.target.result);
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleCreate = async () => {
    if (!title.trim()) { setError("Title is required"); return; }
    if (!markdown.trim()) { setError("Content is required (upload or paste)"); return; }
    setSaving(true);
    setError("");
    try {
      await onCreate(title.trim(), markdown);
      setTitle("");
      setMarkdown("");
      setFileName("");
      onClose();
    } catch (e) {
      setError(e.message || "Failed to add lesson");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999, display: "flex",
      alignItems: "center", justifyContent: "center",
      background: C.overlay, animation: "overlayFade 0.2s ease-out",
    }} onClick={onClose}>
      <div className="slide-up add-lesson-modal-content" style={{
        background: C.card, borderRadius: 20, padding: 32, width: "calc(100% - 48px)",
        maxWidth: 420, boxShadow: "0 8px 32px rgba(0,60,50,0.15)",
        maxHeight: "85vh", overflowY: "auto",
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 24, textAlign: "center" }}>
          Add lesson
        </h3>

        {/* Lesson title */}
        <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          Lesson title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Los verbos reflexivos"
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`,
            background: C.inputBg, fontSize: 15, fontWeight: 600, color: C.text,
            fontFamily: "'Nunito', sans-serif", outline: "none", marginBottom: 16,
          }}
          onFocus={(e) => (e.target.style.borderColor = C.accent)}
          onBlur={(e) => (e.target.style.borderColor = C.border)}
        />

        {/* Week context */}
        <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          Week
        </label>
        <div style={{
          padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`,
          background: C.accentLight, fontSize: 14, fontWeight: 700, color: C.accentHover,
          marginBottom: 20,
        }}>
          {weekLabel}
        </div>

        {/* Divider */}
        <div style={{ borderTop: `1px solid ${C.border}`, margin: "0 0 20px" }} />

        {/* Upload zone */}
        <div
          style={{
            border: `2px dashed ${C.border}`, borderRadius: 12,
            padding: "20px 16px", textAlign: "center", cursor: "pointer",
            transition: "all 0.2s", marginBottom: 12,
            background: fileName ? C.accentLight : "transparent",
          }}
          onClick={() => fileRef.current?.click()}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p style={{ color: fileName ? C.accentHover : C.muted, fontSize: 14, fontWeight: 600 }}>
            {fileName || "Upload .md file"}
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".md,.txt"
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
        />

        {/* OR divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
          <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>OR</span>
          <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
        </div>

        {/* Paste markdown */}
        <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          Paste markdown
        </label>
        <textarea
          value={markdown}
          onChange={(e) => { setMarkdown(e.target.value); setFileName(""); }}
          placeholder="Paste your markdown content here..."
          style={{
            width: "100%", minHeight: 120, padding: "12px 14px", borderRadius: 12,
            border: `1.5px solid ${C.border}`, background: C.inputBg, fontSize: 14,
            fontWeight: 600, color: C.text, fontFamily: "'Nunito', sans-serif",
            outline: "none", resize: "vertical", lineHeight: 1.6,
          }}
          onFocus={(e) => (e.target.style.borderColor = C.accent)}
          onBlur={(e) => (e.target.style.borderColor = C.border)}
        />

        {error && (
          <p style={{ color: C.error, fontSize: 13, fontWeight: 600, textAlign: "center", marginTop: 12 }}>{error}</p>
        )}

        {/* Buttons */}
        <div style={{ marginTop: 20 }}>
          <button onClick={handleCreate} disabled={saving} style={{
            width: "100%", padding: "14px", borderRadius: 14, border: "none",
            background: C.accent, color: "white", fontWeight: 800, fontSize: 15,
            cursor: saving ? "default" : "pointer", fontFamily: "'Nunito', sans-serif",
            opacity: saving ? 0.7 : 1, marginBottom: 10, minHeight: 48,
          }}>
            {saving ? "Adding..." : "Add lesson"}
          </button>
          <button onClick={onClose} style={{
            width: "100%", padding: "14px", borderRadius: 14, border: `2px solid ${C.border}`,
            background: "transparent", color: C.text, fontWeight: 700, fontSize: 15,
            cursor: "pointer", fontFamily: "'Nunito', sans-serif", minHeight: 48,
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
