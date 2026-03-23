import { useState, useEffect, useRef } from "react";
import { C } from "../../styles/theme";
import { fetchLessonLinks, fetchLinkPreview, createLessonLink, deleteLessonLink } from "../../lib/api";

// Chain-link icon (green)
const LinkIcon = ({ size = 20, color = C.accent, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

// External arrow icon
const ExternalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// Globe fallback icon
const GlobeIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Favicon with letter-circle fallback
function Favicon({ src, domain }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [src]);

  if (!src || failed) {
    const letter = (domain || "?")[0].toUpperCase();
    // Deterministic color from domain
    let hash = 0;
    for (let i = 0; i < (domain || "").length; i++) hash = (domain || "").charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return (
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: `hsl(${hue}, 45%, 90%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 800, color: `hsl(${hue}, 50%, 40%)`,
      }}>
        {letter}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={32}
      height={32}
      style={{ borderRadius: 8, flexShrink: 0, objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
}

export default function LessonLinks({ lessonId }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [preview, setPreview] = useState(null); // { title, domain, faviconUrl, url }
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const inputRef = useRef(null);
  const titleInputRef = useRef(null);

  // Load links on mount
  useEffect(() => {
    fetchLessonLinks(lessonId)
      .then(setLinks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lessonId]);

  const handleSaveUrl = async () => {
    const trimmed = urlInput.trim();
    if (!isValidUrl(trimmed)) return;

    setFetching(true);
    setAdding(false);

    try {
      const data = await fetchLinkPreview(trimmed);
      setPreview({ ...data, url: trimmed });
      setEditTitle(data.title || trimmed);
    } catch {
      // Fallback: use URL as title
      let domain = trimmed;
      try { domain = new URL(trimmed).hostname; } catch {}
      setPreview({ title: trimmed, domain, faviconUrl: null, url: trimmed });
      setEditTitle(trimmed);
    } finally {
      setFetching(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!preview || saving) return;
    setSaving(true);

    const linkData = {
      url: preview.url,
      title: editTitle.trim() || preview.url,
      domain: preview.domain,
      faviconUrl: preview.faviconUrl,
    };

    try {
      const saved = await createLessonLink(lessonId, linkData);
      setLinks((prev) => [...prev, saved]);
    } catch (e) {
      console.error("Failed to save link:", e);
    } finally {
      setSaving(false);
      setPreview(null);
      setUrlInput("");
    }
  };

  const handleDelete = async (linkId) => {
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
    try {
      await deleteLessonLink(lessonId, linkId);
    } catch (e) {
      console.error("Failed to delete link:", e);
      // Refetch to restore
      fetchLessonLinks(lessonId).then(setLinks).catch(() => {});
    }
  };

  const handleCancel = () => {
    setAdding(false);
    setUrlInput("");
    setPreview(null);
    setFetching(false);
  };

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  useEffect(() => {
    if (preview && titleInputRef.current) titleInputRef.current.focus();
  }, [preview]);

  // Loading skeleton
  if (loading) {
    return (
      <div style={{
        background: C.card, borderRadius: 14, padding: 20,
        border: `1px solid ${C.border}`,
      }}>
        <div className="skeleton" style={{ height: 20, width: 80, borderRadius: 6, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 52, borderRadius: 12 }} />
      </div>
    );
  }

  return (
    <div style={{
      background: C.card, borderRadius: 14, padding: 20,
      border: `1px solid ${C.border}`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LinkIcon size={18} />
          <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Links</span>
        </div>
        {links.length > 0 && (
          <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>
            {links.length} link{links.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Empty state */}
      {links.length === 0 && !adding && !fetching && !preview && (
        <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
          <LinkIcon size={28} color={C.border} style={{ margin: "0 auto 8px", display: "block", opacity: 0.6 }} />
          <p style={{ color: C.muted, fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
            Save lesson links, recordings,<br />and resources here
          </p>
        </div>
      )}

      {/* Link list */}
      {links.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
          {links.map((link) => (
            <div
              key={link.id}
              onClick={() => window.open(link.url, "_blank")}
              onMouseEnter={() => setHoveredId(link.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 12,
                border: `1px solid ${C.border}`, background: "#FFFFFF",
                cursor: "pointer", transition: "background 0.12s",
                position: "relative",
                ...(hoveredId === link.id ? { background: "#FAFFFE" } : {}),
              }}
            >
              <Favicon src={link.favicon_url} domain={link.domain} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: C.text,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {link.title}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 1 }}>
                  {link.domain}
                </div>
              </div>
              <ExternalIcon />

              {/* Delete button — hover only */}
              {hoveredId === link.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(link.id); }}
                  style={{
                    position: "absolute", top: -6, right: -6,
                    width: 22, height: 22, borderRadius: "50%",
                    background: "#FFFFFF", border: `1px solid ${C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", padding: 0,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.error; e.currentTarget.style.color = C.error; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Fetching preview — skeleton */}
      {fetching && (
        <div style={{
          padding: "14px 12px", borderRadius: 12, marginBottom: 8,
          background: C.inputBg,
        }}>
          <div className="skeleton" style={{ height: 14, width: "80%", borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 10, width: "50%", borderRadius: 6 }} />
        </div>
      )}

      {/* Preview card — editable title before confirming */}
      {preview && !fetching && (
        <div style={{
          padding: "10px 12px", borderRadius: 12, marginBottom: 8,
          border: `1px solid ${C.accent}`, background: "#FAFFFE",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Favicon src={preview.faviconUrl} domain={preview.domain} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                ref={titleInputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmSave();
                  if (e.key === "Escape") handleCancel();
                }}
                style={{
                  width: "100%", fontSize: 13, fontWeight: 700, color: C.text,
                  border: "none", background: "transparent", outline: "none",
                  padding: 0, fontFamily: "'Nunito', sans-serif",
                }}
              />
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 1 }}>
                {preview.domain}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            <button
              onClick={handleCancel}
              style={{
                background: "none", border: "none", color: C.muted,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "'Nunito', sans-serif", padding: "4px 12px",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmSave}
              disabled={saving}
              style={{
                background: C.accent, color: "#FFFFFF", border: "none",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "'Nunito', sans-serif", padding: "6px 16px",
                borderRadius: 8, opacity: saving ? 0.6 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Adding — URL input */}
      {adding && (
        <div style={{ marginBottom: 8 }}>
          <input
            ref={inputRef}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isValidUrl(urlInput.trim())) handleSaveUrl();
              if (e.key === "Escape") handleCancel();
            }}
            placeholder="Paste a URL..."
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${C.border}`, fontSize: 13, fontWeight: 600,
              color: C.text, fontFamily: "'Nunito', sans-serif",
              outline: "none", background: C.inputBg,
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = C.accent)}
            onBlur={(e) => (e.target.style.borderColor = C.border)}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button
              onClick={handleCancel}
              style={{
                background: "none", border: "none", color: C.muted,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "'Nunito', sans-serif", padding: "4px 12px",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveUrl}
              disabled={!isValidUrl(urlInput.trim())}
              style={{
                background: "none", border: `1.5px solid ${C.border}`,
                color: C.text, fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "'Nunito', sans-serif", padding: "6px 16px",
                borderRadius: 8, opacity: isValidUrl(urlInput.trim()) ? 1 : 0.4,
                transition: "opacity 0.15s",
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Add link button — always visible unless in adding/fetching/preview state */}
      {!adding && !fetching && !preview && (
        <button
          onClick={() => setAdding(true)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            width: "100%", padding: "10px", borderRadius: 12,
            border: `2px dashed ${C.border}`, background: "transparent",
            color: C.text, fontWeight: 700, fontSize: 13,
            cursor: "pointer", fontFamily: "'Nunito', sans-serif",
            transition: "all 0.15s", marginTop: links.length > 0 ? 0 : 4,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text; }}
        >
          + Add link
        </button>
      )}
    </div>
  );
}
