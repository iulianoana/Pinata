import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getPrompts, updatePrompt, undoPrompt } from "../lib/api.js";

// ── Constants ──

const GROUPS = [
  { key: "carolina-text", label: "Carolina Text", icon: "\uD83D\uDCAC" },
  { key: "carolina-voice", label: "Carolina Voice", icon: "\uD83C\uDF99\uFE0F" },
  { key: "lesson", label: "Lesson", icon: "\uD83D\uDCDA" },
  { key: "vocab", label: "Vocabulary", icon: "\uD83D\uDCD6" },
  { key: "conjugar", label: "Conjugar", icon: "\uD83E\uDDE9" },
];

const VAR_REGEX = /\{\{(\w+)\}\}/g;

// ── Styles ──

const S = {
  page: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#FAFCFB",
    fontFamily: "'Nunito', sans-serif",
    overflow: "hidden",
  },
  header: {
    padding: "24px 32px 0",
    flexShrink: 0,
  },
  title: {
    fontSize: 26,
    fontWeight: 900,
    color: "#1A2F2B",
    margin: 0,
  },
  titleAccent: {
    color: "#2d9d6a",
  },
  subtitle: {
    fontSize: 14,
    color: "#5E8078",
    fontWeight: 600,
    marginTop: 4,
  },
  tabBar: {
    display: "flex",
    gap: 4,
    padding: "16px 32px 0",
    borderBottom: "1px solid #D4F0EB",
    flexShrink: 0,
  },
  tab: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    border: "none",
    borderBottom: active ? "2px solid #2d9d6a" : "2px solid transparent",
    background: "transparent",
    color: active ? "#2d9d6a" : "#5E8078",
    fontFamily: "'Nunito', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s",
  }),
  badge: (active) => ({
    background: active ? "#E0F5F1" : "#F0F4F2",
    color: active ? "#2d9d6a" : "#5E8078",
    fontSize: 11,
    fontWeight: 800,
    padding: "2px 7px",
    borderRadius: 10,
  }),
  body: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
    minHeight: 0,
  },
  sidebar: {
    width: 260,
    minWidth: 260,
    borderRight: "1px solid #D4F0EB",
    overflowY: "auto",
    background: "#FFFFFF",
  },
  sidebarLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#5E8078",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "16px 16px 8px",
  },
  promptItem: (active) => ({
    display: "block",
    width: "100%",
    padding: "12px 16px",
    border: "none",
    borderLeft: active ? "3px solid #2d9d6a" : "3px solid transparent",
    background: active ? "#E8F8F3" : "transparent",
    textAlign: "left",
    cursor: "pointer",
    transition: "background 0.12s",
    fontFamily: "'Nunito', sans-serif",
  }),
  promptName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1A2F2B",
    margin: 0,
  },
  promptMeta: {
    fontSize: 11,
    color: "#5E8078",
    fontWeight: 600,
    marginTop: 2,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  promptFilename: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: "#8CA8A0",
  },
  editor: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minWidth: 0,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 24px",
    borderBottom: "1px solid #D4F0EB",
    flexShrink: 0,
    background: "#FFFFFF",
  },
  filenameBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#F5F7F6",
    border: "1px solid #D4F0EB",
    borderRadius: 6,
    padding: "5px 12px",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    color: "#5E8078",
    fontWeight: 500,
  },
  toolbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  undoBtn: (enabled) => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    border: "none",
    color: enabled ? "#5E8078" : "#C0D4CE",
    fontFamily: "'Nunito', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    cursor: enabled ? "pointer" : "default",
    padding: "6px 10px",
    borderRadius: 6,
    transition: "color 0.15s",
  }),
  saveBtn: (enabled) => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: enabled ? "#2d9d6a" : "#A8D5C2",
    border: "none",
    color: "#FFFFFF",
    fontFamily: "'Nunito', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    cursor: enabled ? "pointer" : "default",
    padding: "7px 18px",
    borderRadius: 8,
    transition: "background 0.15s",
  }),
  dirtyDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#2d9d6a",
    animation: "dirtyPulse 2s ease-in-out infinite",
    flexShrink: 0,
  },
  varsStrip: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 24px",
    borderBottom: "1px solid #D4F0EB",
    flexShrink: 0,
    flexWrap: "wrap",
    background: "#FFFFFF",
  },
  varsLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#5E8078",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  varChip: {
    display: "inline-block",
    background: "#fef7e0",
    border: "1px solid #f0d060",
    borderRadius: 5,
    padding: "3px 10px",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    fontWeight: 600,
    color: "#7a6520",
  },
  splitPane: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
    minHeight: 0,
  },
  editorPane: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #D4F0EB",
    minWidth: 0,
  },
  editorLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#5E8078",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "12px 20px 8px",
    flexShrink: 0,
  },
  previewPane: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#5E8078",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "12px 20px 8px",
    flexShrink: 0,
  },
  previewScroll: {
    flex: 1,
    overflowY: "auto",
    padding: "0 24px 24px",
    fontFamily: "'Nunito', sans-serif",
    fontSize: 15,
    lineHeight: 1.7,
    color: "#1A2F2B",
  },
  toast: (visible) => ({
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
    opacity: visible ? 1 : 0,
    background: "#1A2F2B",
    color: "#FFFFFF",
    fontFamily: "'Nunito', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    padding: "10px 20px",
    borderRadius: 10,
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
    transition: "opacity 0.3s, transform 0.3s",
    pointerEvents: "none",
    zIndex: 9999,
  }),
  emptyState: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#5E8078",
    fontSize: 15,
    fontWeight: 600,
  },
};

// ── Helpers ──

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function extractVariables(content) {
  const vars = [];
  const seen = new Set();
  let m;
  const re = new RegExp(VAR_REGEX.source, "g");
  while ((m = re.exec(content)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      vars.push(m[1]);
    }
  }
  return vars;
}

/** Lightweight syntax highlighter for code blocks (JSON-aware, handles common patterns). */
function highlightCode(raw) {
  // HTML-escape first
  let code = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Tokenize and highlight — order matters to avoid double-matching
  // We process via a single regex replace to avoid overlapping spans
  code = code.replace(
    // Match in priority order: comments, strings, numbers, booleans/null, JSON keys
    /(\/\/.*$)|("(?:[^"\\]|\\.)*")\s*(:)|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/gm,
    (match, comment, key, colon, str, bool, num) => {
      if (comment) return `<span style="color:#8CA8A0;font-style:italic">${comment}</span>`;
      if (key) return `<span style="color:#2d7d5a">${key}</span>${colon}`;
      if (str) return `<span style="color:#b35c00">${str}</span>`;
      if (bool) return `<span style="color:#7c5cbf">${bool}</span>`;
      if (num) return `<span style="color:#1a6fb5">${num}</span>`;
      return match;
    }
  );

  return code;
}

/** Build the HTML for a fenced code block. */
function buildCodeBlockHtml(codeLines, codeLang) {
  const raw = codeLines.join("\n");
  const highlighted = highlightCode(raw);
  const langLabel = codeLang
    ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid #D4F0EB;background:#F5F9F7"><span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:#5E8078;text-transform:uppercase;letter-spacing:0.05em">${codeLang}</span></div>`
    : "";
  return (
    `<div style="margin:12px 0;border-radius:8px;background:#F8FBF9;border:1px solid #D4F0EB;overflow:hidden">`
    + langLabel
    + `<pre style="margin:0;padding:16px 20px;overflow-x:auto;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.7;color:#1A2F2B;tab-size:2"><code>${highlighted}</code></pre>`
    + `</div>`
  );
}

/** Simple markdown → HTML (headers, bold, italic, code blocks, lists, paragraphs). */
function renderMarkdown(text) {
  const lines = text.split("\n");
  const html = [];
  let inList = false;
  let inCodeBlock = false;
  let codeLines = [];
  let codeLang = "";

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Fenced code blocks
    if (trimmed.startsWith("```")) {
      if (!inCodeBlock) {
        if (inList) { html.push("</ul>"); inList = false; }
        inCodeBlock = true;
        codeLines = [];
        codeLang = trimmed.slice(3).trim();
        continue;
      } else {
        html.push(buildCodeBlockHtml(codeLines, codeLang));
        inCodeBlock = false;
        codeLines = [];
        codeLang = "";
        continue;
      }
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      if (inList) { html.push("</ul>"); inList = false; }
      const level = headingMatch[1].length;
      const sizes = { 1: 24, 2: 20, 3: 17, 4: 15 };
      html.push(`<div style="font-size:${sizes[level]}px;font-weight:800;margin:16px 0 8px;color:#1A2F2B">${inlineFormat(headingMatch[2])}</div>`);
      continue;
    }

    // List items
    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      if (!inList) { html.push('<ul style="margin:8px 0;padding-left:20px">'); inList = true; }
      html.push(`<li style="margin:3px 0">${inlineFormat(listMatch[1])}</li>`);
      continue;
    }

    // Close list if we left it
    if (inList && !listMatch) {
      html.push("</ul>");
      inList = false;
    }

    // Empty line
    if (!trimmed) {
      html.push('<div style="height:10px"></div>');
      continue;
    }

    // Paragraph
    html.push(`<div>${inlineFormat(trimmed)}</div>`);
  }

  // Close any unclosed code block
  if (inCodeBlock) {
    html.push(buildCodeBlockHtml(codeLines, codeLang));
  }

  if (inList) html.push("</ul>");
  return html.join("\n");
}

/** Inline formatting: bold, italic, code, and {{variables}} */
function inlineFormat(text) {
  return text
    .replace(/\{\{(\w+)\}\}/g, '<span style="background:#fef7e0;border-bottom:2px solid #f0d060;color:#7a6520;font-family:\'JetBrains Mono\',monospace;font-size:0.9em;padding:1px 6px;border-radius:3px">{{$1}}</span>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code style="background:#F0F4F2;padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>');
}

// ── Inject keyframe animation ──
function injectPromptStyles() {
  if (document.getElementById("prompt-mgr-styles")) return;
  const style = document.createElement("style");
  style.id = "prompt-mgr-styles";
  style.textContent = `
    @keyframes dirtyPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .prompt-editor-wrap { position:relative; flex:1; overflow:hidden; }
    .prompt-editor-highlight {
      position:absolute; top:0; left:0; right:0; bottom:0;
      padding:12px 20px; pointer-events:none; white-space:pre-wrap; word-wrap:break-word;
      font-family:'JetBrains Mono',monospace; font-size:14px; line-height:1.7;
      color:transparent; overflow-y:auto;
    }
    .prompt-editor-textarea {
      position:absolute; top:0; left:0; width:100%; height:100%;
      padding:12px 20px; border:none; outline:none; resize:none;
      font-family:'JetBrains Mono',monospace; font-size:14px; line-height:1.7;
      color:#1A2F2B; background:transparent; caret-color:#1A2F2B;
      overflow-y:auto;
    }
    .prompt-editor-textarea::placeholder { color:#B0CCC4; }
    /* Variable highlight mark — no padding/margin/border so text flow matches textarea exactly */
    .prompt-var-mark {
      background:#fef7e0;
      box-shadow:0 2px 0 0 #f0d060;
      border-radius:2px;
      color:transparent;
      padding:0; margin:0; border:none;
    }
    /* Sync scroll */
    .prompt-editor-textarea::-webkit-scrollbar { width:6px; }
    .prompt-editor-textarea::-webkit-scrollbar-thumb { background:#D4F0EB; border-radius:3px; }
  `;
  document.head.appendChild(style);
}

// ── Editor with variable highlighting overlay ──

function HighlightEditor({ value, onChange }) {
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);

  const handleScroll = () => {
    if (highlightRef.current && textareaRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Escape HTML first, then wrap {{variables}} in highlight spans.
  // CRITICAL: spans must NOT have padding, margin, border, or anything
  // that changes text flow — only background + box-shadow for underline.
  const buildHighlightHtml = (text) => {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return escaped.replace(
      /\{\{(\w+)\}\}/g,
      '<mark class="prompt-var-mark">{{$1}}</mark>'
    );
  };

  return (
    <div className="prompt-editor-wrap">
      <div
        ref={highlightRef}
        className="prompt-editor-highlight"
        dangerouslySetInnerHTML={{ __html: buildHighlightHtml(value) + "\n" }}
      />
      <textarea
        ref={textareaRef}
        className="prompt-editor-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        spellCheck={false}
      />
    </div>
  );
}

// ── Main Component ──

export default function PromptsScreen() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState("carolina-text");
  const [selectedId, setSelectedId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [toast, setToast] = useState({ text: "", visible: false });
  const [saving, setSaving] = useState(false);

  // Inject styles
  useEffect(() => { injectPromptStyles(); }, []);

  // Load prompts
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPrompts()
      .then((data) => {
        if (cancelled) return;
        setPrompts(data || []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Group prompts
  const grouped = useMemo(() => {
    const map = {};
    for (const g of GROUPS) map[g.key] = [];
    for (const p of prompts) {
      if (map[p.group_key]) map[p.group_key].push(p);
    }
    return map;
  }, [prompts]);

  // Auto-select first prompt when switching groups or on load
  useEffect(() => {
    const list = grouped[activeGroup] || [];
    if (list.length > 0) {
      const first = list[0];
      setSelectedId(first.id);
      setEditContent(first.content);
    } else {
      setSelectedId(null);
      setEditContent("");
    }
  }, [activeGroup, grouped]);

  const selected = prompts.find((p) => p.id === selectedId);
  const isDirty = selected && editContent !== selected.content;
  const variables = useMemo(() => extractVariables(editContent), [editContent]);

  const showToast = useCallback((text) => {
    setToast({ text, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2200);
  }, []);

  const handleSelectPrompt = (p) => {
    setSelectedId(p.id);
    setEditContent(p.content);
  };

  const handleSave = async () => {
    if (!selected || !isDirty || saving) return;
    setSaving(true);
    try {
      await updatePrompt(selected.id, editContent);
      setPrompts((prev) =>
        prev.map((p) =>
          p.id === selected.id
            ? { ...p, content: editContent, previous_content: p.content, updated_at: new Date().toISOString() }
            : p
        )
      );
      showToast("\u2713 Prompt saved");
    } catch (err) {
      showToast("Failed to save: " + err.message);
    }
    setSaving(false);
  };

  const handleUndo = async () => {
    if (!selected || !selected.previous_content || saving) return;
    setSaving(true);
    try {
      const result = await undoPrompt(selected.id);
      setPrompts((prev) =>
        prev.map((p) =>
          p.id === selected.id
            ? { ...p, content: result.content, previous_content: result.previous_content, updated_at: new Date().toISOString() }
            : p
        )
      );
      setEditContent(result.content);
      showToast("\u21A9 Reverted to previous version");
    } catch (err) {
      showToast("Failed to undo: " + err.message);
    }
    setSaving(false);
  };

  // Keyboard shortcut: Ctrl/Cmd+S to save
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (loading) {
    return (
      <div className="desktop-main" style={S.page}>
        <div style={S.emptyState}>Loading prompts...</div>
      </div>
    );
  }

  return (
    <div className="desktop-main" style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>
          Prompt <span style={S.titleAccent}>Manager</span>
        </h1>
        <p style={S.subtitle}>Edit and manage AI prompts for Carolina and lesson generation</p>
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {GROUPS.map((g) => {
          const active = activeGroup === g.key;
          const count = (grouped[g.key] || []).length;
          return (
            <button
              key={g.key}
              style={S.tab(active)}
              onClick={() => setActiveGroup(g.key)}
            >
              <span>{g.icon}</span>
              <span>{g.label}</span>
              <span style={S.badge(active)}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Body: sidebar + editor */}
      <div style={S.body}>
        {/* Sidebar */}
        <div style={S.sidebar}>
          <div style={S.sidebarLabel}>Prompts</div>
          {(grouped[activeGroup] || []).map((p) => (
            <button
              key={p.id}
              style={S.promptItem(selectedId === p.id)}
              onClick={() => handleSelectPrompt(p)}
              onMouseEnter={(e) => {
                if (selectedId !== p.id) e.currentTarget.style.background = "#F0FAF8";
              }}
              onMouseLeave={(e) => {
                if (selectedId !== p.id) e.currentTarget.style.background = "transparent";
              }}
            >
              <div style={S.promptName}>{p.name}</div>
              <div style={S.promptMeta}>
                <span>{timeAgo(p.updated_at)}</span>
                <span style={S.promptFilename}>{p.filename}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Editor area */}
        {selected ? (
          <div style={S.editor}>
            {/* Toolbar */}
            <div style={S.toolbar}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={S.filenameBadge}>{selected.filename}</span>
                {isDirty && <span style={S.dirtyDot} />}
              </div>
              <div style={S.toolbarRight}>
                <button
                  style={S.undoBtn(!!selected.previous_content)}
                  onClick={handleUndo}
                  disabled={!selected.previous_content}
                  title="Revert to previous saved version"
                >
                  <span>\u21A9</span> Undo
                </button>
                <button
                  style={S.saveBtn(isDirty)}
                  onClick={handleSave}
                  disabled={!isDirty}
                >
                  Save
                </button>
              </div>
            </div>

            {/* Variables strip */}
            {variables.length > 0 && (
              <div style={S.varsStrip}>
                <span style={S.varsLabel}>Variables</span>
                {variables.map((v) => (
                  <span key={v} style={S.varChip}>{`{{${v}}}`}</span>
                ))}
              </div>
            )}

            {/* Split pane */}
            <div style={S.splitPane}>
              {/* Editor */}
              <div style={S.editorPane}>
                <div style={S.editorLabel}>Editor</div>
                <HighlightEditor
                  value={editContent}
                  onChange={setEditContent}
                />
              </div>

              {/* Preview */}
              <div style={S.previewPane}>
                <div style={S.previewLabel}>Preview</div>
                <div
                  style={S.previewScroll}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(editContent) }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div style={S.emptyState}>
            No prompts in this group
          </div>
        )}
      </div>

      {/* Toast */}
      <div style={S.toast(toast.visible)}>{toast.text}</div>
    </div>
  );
}
