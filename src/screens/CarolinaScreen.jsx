import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { C } from "../styles/theme";
import { supabase, getCachedSession } from "../lib/supabase.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ResourcePills, ResourcePicker, resolveResourceLabels } from "../components/ResourcePicker";

// ─── Carolina palette ──────────────────────────────────────────
const K = {
  bg: "#f0faf5",
  primary: "#3ABFA0",
  primaryDark: "#0F6E56",
  activeBg: "#E8F8F3",
  activeBorder: "#b8e8d6",
  bubbleBorder: "#e2e8e4",
  errorText: "#E24B4A",
  correctionText: "#1D9E75",
  pillBg: "#fff3e0",
  pillText: "#854F0B",
  inputBg: "#f5f5f0",
  timestamp: "#9aaa9f",
};

// ─── Modes ─────────────────────────────────────────────────────
const MODES = [
  { id: "essay", title: "Essay practice", desc: "Mini writing assignments" },
  { id: "grammar", title: "Grammar Q&A", desc: "Ask about specific rules" },
  { id: "vocab", title: "Vocab drill", desc: "Use words in context" },
  { id: "conversation", title: "Conversation", desc: "Free chat in Spanish" },
];

const MODE_LABELS = {
  essay: "Essay", grammar: "Grammar", vocab: "Vocab", conversation: "Conversation",
};

const OPENING_MESSAGES = {
  essay: "\u00a1Vamos a escribir! Te voy a dar un tema y t\u00fa escribes 2-3 frases. \u00bfListo?",
  grammar: "\u00a1Hola! Preg\u00fantame lo que quieras sobre gram\u00e1tica espa\u00f1ola. Estoy aqu\u00ed para ayudarte.",
  vocab: "\u00a1Vamos a practicar vocabulario! Te doy una palabra y t\u00fa la usas en una frase. \u00bfEmpezamos?",
  conversation: "\u00a1Hola Iulian! \u00bfDe qu\u00e9 quieres hablar hoy? Podemos hablar de lo que quieras.",
};

const MODE_ICONS = {
  essay: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  grammar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  vocab: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  conversation: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
};

// ─── Helpers ───────────────────────────────────────────────────
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getAuthHeaders() {
  // Read from localStorage — supabase.auth.getSession() blocks up to 30s offline.
  const session = getCachedSession();
  return {
    Authorization: `Bearer ${session?.access_token || ""}`,
    "Content-Type": "application/json",
  };
}

// Carolina CSS styles are now in app/globals.css

// ─── Carolina Avatar ───────────────────────────────────────────
function CarolinaAvatar({ size = 26 }) {
  return (
    <img
      src="/images/Carolina.png"
      alt="Carolina"
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        objectFit: "cover",
      }}
    />
  );
}

// ─── Message Content (with correction rendering) ───────────────
function MessageContent({ content }) {
  const correctionPattern = /~~(.+?)~~\s*→\s*\*\*(.+?)\*\*/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = correctionPattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "md", text: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "correction", wrong: match[1], right: match[2] });
    lastIndex = correctionPattern.lastIndex;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "md", text: content.slice(lastIndex) });
  }

  if (parts.length === 1 && parts[0].type === "md") {
    return (
      <div className="carolina-md">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="carolina-md">
      {parts.map((part, i) =>
        part.type === "correction" ? (
          <span key={i}>
            <span style={{ color: K.errorText, textDecoration: "line-through" }}>{part.wrong}</span>
            {" \u2192 "}
            <span style={{ color: K.correctionText, fontWeight: 700 }}>{part.right}</span>
          </span>
        ) : (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
        )
      )}
    </div>
  );
}

// ─── Typing Dots ───────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "4px 0" }}>
      <span className="carolina-dot" />
      <span className="carolina-dot" />
      <span className="carolina-dot" />
    </div>
  );
}

// ─── User Avatar ──────────────────────────────────────────────
function UserAvatar({ size = 26 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: C.accent, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.5, fontWeight: 800,
      fontFamily: "'Nunito', sans-serif",
    }}>
      I
    </div>
  );
}

// ─── Message Bubble ────────────────────────────────────────────
function MessageBubble({ message, isStreaming }) {
  const isUser = message.role === "user";

  return (
    <div style={{
      display: "flex", flexDirection: isUser ? "row-reverse" : "row",
      alignItems: "flex-start", gap: 8, marginBottom: 16,
    }}>
      {isUser ? <UserAvatar size={26} /> : <CarolinaAvatar size={26} />}
      <div className="carolina-bubble" style={{
        maxWidth: "75%", display: "flex", flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
      }}>
        <div style={{
          padding: "10px 14px",
          borderRadius: isUser ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
          background: isUser ? K.primary : "#FFFFFF",
          color: isUser ? "#FFFFFF" : C.text,
          border: isUser ? "none" : `0.5px solid ${K.bubbleBorder}`,
          fontSize: 14, lineHeight: 1.5,
          fontFamily: "'Nunito', sans-serif",
          wordBreak: "break-word",
        }}>
          {isStreaming ? (
            message.content ? <span>{message.content}</span> : <TypingDots />
          ) : isUser ? (
            <span>{message.content}</span>
          ) : (
            <MessageContent content={message.content} />
          )}
        </div>
        {message.createdAt && (
          <span style={{
            fontSize: 9, color: K.timestamp, marginTop: 4,
            fontFamily: "'Nunito', sans-serif", fontWeight: 600,
          }}>
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────
function CarolinaHeader({ activeSessionId, title, mode, resources, starred, onToggleStar, onCallClick, onHistoryClick, isMobile }) {
  const navigate = useNavigate();
  const modeObj = mode ? MODES.find((m) => m.id === mode) : null;
  const resourceSummary =
    resources?.length > 0 ? resources.map((r) => r.label).join(", ") : null;

  return (
    <div className="safe-top" style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px", background: "#FFFFFF",
      borderBottom: `0.5px solid ${K.bubbleBorder}`, flexShrink: 0,
    }}>
      <button
        onClick={() => navigate(-1)}
        className="carolina-back-btn"
        style={{
          background: "none", border: "none", cursor: "pointer",
          padding: 4, color: C.text, alignItems: "center",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <CarolinaAvatar size={30} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 600, color: C.text,
          fontFamily: "'Nunito', sans-serif",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {activeSessionId && title ? title : "Carolina"}
        </div>
        <div style={{
          fontSize: 12, fontFamily: "'Nunito', sans-serif", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 6, minWidth: 0,
        }}>
          {activeSessionId && modeObj ? (
            <>
              <span style={{
                background: K.activeBg, color: K.correctionText,
                padding: "1px 8px", borderRadius: 6, fontSize: 11,
                fontWeight: 700, flexShrink: 0,
              }}>
                {modeObj.title}
              </span>
              {resourceSummary && (
                <span style={{
                  color: C.muted, fontSize: 11,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {resourceSummary}
                </span>
              )}
            </>
          ) : (
            <span style={{ color: K.primary }}>Your Spanish practice buddy</span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {/* Star button */}
        {activeSessionId && activeSessionId !== "pending" && (
          <button
            onClick={onToggleStar}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 6, display: "flex",
            }}
          >
            {starred ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#EF9F27" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            )}
          </button>
        )}

        {/* History button (mobile only) */}
        {isMobile && (
          <button
            onClick={onHistoryClick}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 6, color: C.muted, display: "flex",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        )}

        {/* Call button */}
        <button
          onClick={onCallClick}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "transparent", border: `1.5px solid ${K.primary}`,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: K.primary, flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────
function EmptyState({ onSelectMode }) {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 20px", textAlign: "center",
    }}>
      <CarolinaAvatar size={80} />
      <h2 style={{
        fontSize: 20, fontWeight: 800, color: C.text,
        marginTop: 20, fontFamily: "'Nunito', sans-serif",
      }}>
        {"\u00bfQu\u00e9 quieres practicar?"}
      </h2>
      <p style={{
        fontSize: 14, color: C.muted, marginTop: 6,
        fontFamily: "'Nunito', sans-serif", fontWeight: 600,
      }}>
        Choose a mode or just start chatting
      </p>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 12, marginTop: 24, width: "100%", maxWidth: 400,
      }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelectMode(m.id)}
            style={{
              background: "#FFFFFF",
              border: `0.5px solid ${K.bubbleBorder}`,
              borderRadius: 12, padding: "20px 12px",
              cursor: "pointer", textAlign: "center",
              fontFamily: "'Nunito', sans-serif",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = K.activeBorder;
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = K.bubbleBorder;
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: K.activeBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 10px",
            }}>
              {MODE_ICONS[m.id]}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{m.title}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{m.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Chat Input ────────────────────────────────────────────────
function ChatInput({ value, onChange, onSend, onAttach, disabled, isMobile }) {
  const textareaRef = useRef(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!window.visualViewport) return;
    const vv = window.visualViewport;
    const onResize = () => {
      setKeyboardOpen(vv.height < window.innerHeight * 0.75);
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault();
      if (value.trim() && !disabled) onSend();
    }
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
    }
  }, [value]);

  const hasText = value.trim().length > 0;

  return (
    <div style={{
      display: "flex", alignItems: "flex-end", gap: 10,
      padding: "10px 16px",
      paddingBottom: keyboardOpen ? 10 : "max(10px, env(safe-area-inset-bottom, 10px))",
      background: "#FFFFFF",
      borderTop: `0.5px solid ${K.bubbleBorder}`,
      flexShrink: 0,
    }}>
      <button
        onClick={onAttach}
        style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "none", border: `1.5px solid ${K.bubbleBorder}`,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          color: C.muted, flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribe un mensaje..."
        enterKeyHint={isMobile ? "enter" : "send"}
        rows={1}
        style={{
          flex: 1, resize: "none",
          border: `0.5px solid ${K.bubbleBorder}`,
          borderRadius: 20, padding: "9px 16px",
          background: K.inputBg, fontSize: 14,
          fontFamily: "'Nunito', sans-serif",
          lineHeight: 1.4, outline: "none",
          maxHeight: 100, color: C.text,
        }}
      />

      <button
        onClick={() => { if (hasText && !disabled) onSend(); }}
        style={{
          width: 36, height: 36, borderRadius: "50%",
          background: hasText && !disabled ? K.primary : "#e0e0dc",
          border: "none",
          cursor: hasText && !disabled ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, transition: "background 0.15s",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </div>
  );
}

// ─── Conversations Overlay (Mobile) ─────────────────────────────
function ConversationsOverlay({ isOpen, onClose, onSelectSession, onNewChat, availableResources }) {
  const [sessions, setSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery("");
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/carolina/sessions", { headers });
        if (res.ok) setSessions(await res.json());
      } catch {}
    })();
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/carolina/search?q=${encodeURIComponent(searchQuery.trim())}`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        const grouped = [];
        const seen = new Set();
        for (const r of data) {
          if (!seen.has(r.session_id)) {
            seen.add(r.session_id);
            grouped.push({
              sessionId: r.session_id,
              title: r.session_title,
              mode: r.session_mode,
              snippet: r.content.substring(0, 80) + (r.content.length > 80 ? "\u2026" : ""),
            });
          }
        }
        setSearchResults(grouped);
      } catch {}
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  if (!isOpen) return null;

  const starredSessions = sessions.filter((s) => s.starred);
  const recentSessions = sessions.filter((s) => !s.starred);

  const getResourceLabels = (resources) => {
    if (!resources?.length || !availableResources?.length) return [];
    const lessonMap = {};
    for (const week of availableResources) {
      for (const lesson of week.lessons || []) {
        lessonMap[lesson.id] = `Wk ${week.week_number}`;
      }
    }
    return resources.map((r) => lessonMap[r.id]).filter(Boolean);
  };

  const renderCard = (session) => (
    <button
      key={session.id}
      onClick={() => { onSelectSession(session.id); onClose(); }}
      style={{
        width: "100%", background: "#FFFFFF", borderRadius: 12,
        border: `0.5px solid ${K.bubbleBorder}`, padding: "14px 16px",
        cursor: "pointer", textAlign: "left", marginBottom: 10,
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        {session.starred && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#EF9F27" stroke="none">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        )}
        <span style={{
          flex: 1, fontSize: 14, fontWeight: 700, color: C.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {session.title || "New conversation"}
        </span>
        {session.mode && (
          <span style={{
            fontSize: 11, fontWeight: 600, color: K.correctionText,
            padding: "2px 8px", borderRadius: 6,
            background: K.activeBg, flexShrink: 0,
          }}>
            {MODE_LABELS[session.mode] || session.mode}
          </span>
        )}
      </div>
      {session.last_message && (
        <div style={{
          fontSize: 11, color: C.muted, fontWeight: 500,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          marginBottom: 6,
        }}>
          {session.last_message.content}
        </div>
      )}
      {(() => {
        const labels = getResourceLabels(session.resources);
        if (!labels.length) return null;
        return (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {labels.map((label, i) => (
              <span key={i} style={{
                fontSize: 10, fontWeight: 600, color: K.pillText,
                background: K.pillBg, padding: "2px 8px", borderRadius: 6,
              }}>
                {label}
              </span>
            ))}
          </div>
        );
      })()}
    </button>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: K.bg, display: "flex", flexDirection: "column",
      fontFamily: "'Nunito', sans-serif",
      animation: "sheetUp 0.3s ease-out both",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px",
        paddingTop: "max(12px, env(safe-area-inset-top, 12px))",
        background: "#FFFFFF", borderBottom: `0.5px solid ${K.bubbleBorder}`,
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          padding: 4, color: C.text, display: "flex",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span style={{ flex: 1, fontSize: 17, fontWeight: 800, color: C.text }}>
          Conversations
        </span>
        <button onClick={() => { onNewChat(); onClose(); }} style={{
          width: 32, height: 32, borderRadius: "50%",
          background: K.primary, border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Search bar */}
      <div style={{ padding: "12px 16px", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#FFFFFF", borderRadius: 10, padding: "10px 14px",
          border: `1px solid ${C.border}`,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: 14, fontFamily: "'Nunito', sans-serif", fontWeight: 600,
              color: C.text,
            }}
          />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
        {searchQuery.trim() ? (
          searchResults.length > 0 ? (
            searchResults.map((r) => (
              <button
                key={r.sessionId}
                onClick={() => { onSelectSession(r.sessionId); onClose(); }}
                style={{
                  width: "100%", background: "#FFFFFF", borderRadius: 12,
                  border: `0.5px solid ${K.bubbleBorder}`, padding: "14px 16px",
                  cursor: "pointer", textAlign: "left", marginBottom: 10,
                  fontFamily: "'Nunito', sans-serif",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: C.text }}>
                    {r.title || "Untitled"}
                  </span>
                  {r.mode && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: K.correctionText,
                      padding: "2px 8px", borderRadius: 6,
                      background: K.activeBg, flexShrink: 0,
                    }}>
                      {MODE_LABELS[r.mode] || r.mode}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 11, color: C.muted, fontWeight: 500,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {r.snippet}
                </div>
              </button>
            ))
          ) : (
            <div style={{ textAlign: "center", padding: 32, color: C.muted, fontSize: 14, fontWeight: 600 }}>
              No results found
            </div>
          )
        ) : (
          <>
            {starredSessions.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 11, fontWeight: 800, color: C.muted,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  padding: "8px 0 6px",
                }}>Starred</div>
                {starredSessions.map(renderCard)}
              </div>
            )}
            <div>
              <div style={{
                fontSize: 11, fontWeight: 800, color: C.muted,
                textTransform: "uppercase", letterSpacing: "0.08em",
                padding: "8px 0 6px",
              }}>Recent</div>
              {recentSessions.length > 0 ? (
                recentSessions.map(renderCard)
              ) : (
                <div style={{ textAlign: "center", padding: 32, color: C.muted, fontSize: 14, fontWeight: 600 }}>
                  No conversations yet
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Carolina Screen ──────────────────────────────────────
export default function CarolinaScreen({ session }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [mode, setMode] = useState(null);
  const [resources, setResources] = useState([]);
  const [title, setTitle] = useState(null);
  const [inputText, setInputText] = useState("");
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const [availableResources, setAvailableResources] = useState([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState({}); // { id: label }
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [starred, setStarred] = useState(false);
  const [showConversations, setShowConversations] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const isUserScrolledRef = useRef(false);

  // Carolina styles loaded from app/globals.css

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load/reset session based on URL param changes
  const sessionParam = searchParams.get("session");
  useEffect(() => {
    if (sessionParam && sessionParam !== activeSessionId) {
      loadSession(sessionParam);
    } else if (!sessionParam && activeSessionId) {
      setActiveSessionId(null);
      setMessages([]);
      setMode(null);
      setTitle(null);
      setStarred(false);
      setResources([]);
      setSelectedResourceIds({});
    }
  }, [sessionParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch available resources
  const availableResourcesRef = useRef([]);
  useEffect(() => {
    (async () => {
      try {
        const headers = getAuthHeaders();
        const res = await fetch("/api/carolina/resources", { headers });
        const data = res.ok ? await res.json() : [];
        setAvailableResources(data);
        availableResourcesRef.current = data;
      } catch {}
    })();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!isUserScrolledRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingContent]);

  // Scroll position detection
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    isUserScrolledRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 60;
  }, []);



  // ─── Load a session ────────────────────────────────────────
  const loadSession = async (sessionId) => {
    setIsLoadingHistory(true);
    try {
      const headers = await getAuthHeaders();

      // Fetch session+messages and resources in parallel
      const [sessionRes, resourcesRes] = await Promise.all([
        fetch(`/api/carolina/sessions/${sessionId}/messages`, { headers }),
        availableResourcesRef.current.length > 0
          ? Promise.resolve(null)
          : fetch("/api/carolina/resources", { headers }),
      ]);

      if (!sessionRes.ok) throw new Error("Failed to load");
      const data = await sessionRes.json();

      // Ensure we have available resources for label resolution
      let weeks = availableResourcesRef.current;
      if (resourcesRes && resourcesRes.ok) {
        weeks = await resourcesRes.json();
        setAvailableResources(weeks);
        availableResourcesRef.current = weeks;
      }

      setActiveSessionId(sessionId);
      setMessages(
        data.messages.map((m) => ({
          id: m.id, role: m.role, content: m.content, createdAt: m.created_at,
        }))
      );
      setMode(data.session.mode);
      setTitle(data.session.title);
      setStarred(!!data.session.starred);

      const resolved = resolveResourceLabels(data.session.resources, weeks);
      setResources(resolved);
      // Sync picker selections
      const sel = {};
      for (const r of resolved) { sel[r.id] = r.label; }
      setSelectedResourceIds(sel);
    } catch (err) {
      console.error("Failed to load session:", err);
    }
    setIsLoadingHistory(false);
  };

  // ─── Select mode → create session + opening message ────────
  const handleSelectMode = async (selectedMode) => {
    try {
      const headers = await getAuthHeaders();
      const currentResources = Object.entries(selectedResourceIds).map(
        ([id, label]) => ({ type: "lesson", id, label })
      );

      const res = await fetch("/api/carolina/sessions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          mode: selectedMode,
          resources: currentResources.map((r) => ({ type: r.type, id: r.id })),
        }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const newSession = await res.json();

      setActiveSessionId(newSession.id);
      setMode(selectedMode);
      setResources(currentResources);

      const openingMsg = {
        id: "opening-" + Date.now(),
        role: "assistant",
        content: OPENING_MESSAGES[selectedMode],
        createdAt: new Date().toISOString(),
      };
      setMessages([openingMsg]);

      // Save opening message to DB so Claude has context
      await supabase.from("chat_messages").insert({
        session_id: newSession.id,
        role: "assistant",
        content: OPENING_MESSAGES[selectedMode],
      });

      setSearchParams({ session: newSession.id });
      window.dispatchEvent(new CustomEvent("carolina-sessions-changed"));
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  // ─── Star toggle ─────────────────────────────────────────
  const handleToggleStar = async () => {
    if (!activeSessionId || activeSessionId === "pending") return;
    const newStarred = !starred;
    setStarred(newStarred);
    try {
      const headers = await getAuthHeaders();
      await fetch("/api/carolina/sessions", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: activeSessionId, starred: newStarred }),
      });
      window.dispatchEvent(new CustomEvent("carolina-sessions-changed"));
    } catch {
      setStarred(!newStarred);
    }
  };

  // ─── New chat (reset state) ─────────────────────────────
  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setMode(null);
    setTitle(null);
    setStarred(false);
    setResources([]);
    setSelectedResourceIds({});
    setInputText("");
    setSearchParams({});
  };

  // ─── Call button ────────────────────────────────────────
  const handleCallClick = () => navigate("/dialog");

  // ─── Send message ─────────────────────────────────────────
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    const userMsg = {
      id: "user-" + Date.now(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsStreaming(true);
    setStreamingContent("");
    isUserScrolledRef.current = false;

    // If no session yet, switch to chat view immediately
    const hadSession = !!activeSessionId && activeSessionId !== "pending";
    if (!hadSession) {
      setActiveSessionId("pending");
      setMode("conversation");
    }

    try {
      const headers = await getAuthHeaders();
      const currentResources = resources.map((r) => ({ type: r.type || "lesson", id: r.id }));

      const res = await fetch("/api/carolina/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          sessionId: hadSession ? activeSessionId : null,
          message: text,
          mode: mode || "conversation",
          resources: currentResources,
        }),
      });
      if (!res.ok) throw new Error("Chat request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop(); // keep incomplete tail

        for (const event of events) {
          for (const line of event.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "session") {
                setActiveSessionId(data.sessionId);
                setSearchParams({ session: data.sessionId });
              } else if (data.type === "delta") {
                fullResponse += data.text;
                setStreamingContent(fullResponse);
              } else if (data.type === "error") {
                console.error("Stream error:", data.error);
              }
            } catch {}
          }
        }
      }

      if (fullResponse) {
        setMessages((prev) => [
          ...prev,
          {
            id: "assistant-" + Date.now(),
            role: "assistant",
            content: fullResponse,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.error("Send failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: "error-" + Date.now(),
          role: "assistant",
          content: "Lo siento, algo sali\u00f3 mal. Int\u00e9ntalo de nuevo.",
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    setIsStreaming(false);
    setStreamingContent("");
    window.dispatchEvent(new CustomEvent("carolina-sessions-changed"));
  };

  // ─── Resource handling ─────────────────────────────────────
  const handleToggleResource = (lessonId, label) => {
    setSelectedResourceIds((prev) => {
      const next = { ...prev };
      if (lessonId in next) delete next[lessonId];
      else next[lessonId] = label;
      return next;
    });
  };

  const handleAttachResources = async () => {
    const newResources = Object.entries(selectedResourceIds).map(
      ([id, label]) => ({ type: "lesson", id, label })
    );
    setResources(newResources);
    setShowResourcePicker(false);

    if (activeSessionId && activeSessionId !== "pending") {
      try {
        const headers = await getAuthHeaders();
        await fetch("/api/carolina/sessions", {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            id: activeSessionId,
            resources: newResources.map((r) => ({ type: r.type, id: r.id })),
          }),
        });
      } catch {}
    }
  };

  const handleRemoveResource = (id) => {
    setResources((prev) => prev.filter((r) => r.id !== id));
    setSelectedResourceIds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // ─── Render ────────────────────────────────────────────────
  if (isLoadingHistory) {
    return (
      <div className="desktop-main" style={{
        height: "100dvh", display: "flex", alignItems: "center",
        justifyContent: "center", background: K.bg,
      }}>
        <div style={{
          textAlign: "center", color: C.muted,
          fontFamily: "'Nunito', sans-serif", fontWeight: 600, fontSize: 14,
        }}>
          Loading conversation...
        </div>
      </div>
    );
  }

  const hasActiveChat = activeSessionId && activeSessionId !== "pending" ? true : activeSessionId === "pending" ? true : false;

  return (
    <div className="desktop-main" style={{
      height: "100dvh", display: "flex", flexDirection: "column",
      background: K.bg, fontFamily: "'Nunito', sans-serif",
    }}>
      <CarolinaHeader
        activeSessionId={hasActiveChat ? activeSessionId : null}
        title={title}
        mode={mode}
        resources={resources}
        starred={starred}
        onToggleStar={handleToggleStar}
        onCallClick={handleCallClick}
        onHistoryClick={() => setShowConversations(true)}
        isMobile={isMobile}
      />

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflowY: "auto", padding: "16px 16px 8px",
          display: "flex", flexDirection: "column",
        }}
      >
        {!hasActiveChat ? (
          <EmptyState onSelectMode={handleSelectMode} />
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming && (
              <MessageBubble
                message={{
                  id: "streaming",
                  role: "assistant",
                  content: streamingContent,
                  createdAt: null,
                }}
                isStreaming
              />
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div style={{ position: "relative", flexShrink: 0 }}>
        {showResourcePicker && (
          <ResourcePicker
            availableResources={availableResources}
            selectedIds={selectedResourceIds}
            onToggle={handleToggleResource}
            onClose={() => setShowResourcePicker(false)}
            onAttach={handleAttachResources}
            isMobile={isMobile}
          />
        )}
        <ResourcePills resources={resources} onRemove={handleRemoveResource} />
        <ChatInput
          value={inputText}
          onChange={setInputText}
          onSend={handleSend}
          onAttach={() => setShowResourcePicker(!showResourcePicker)}
          disabled={isStreaming}
          isMobile={isMobile}
        />
      </div>

      {/* Mobile conversations overlay */}
      <ConversationsOverlay
        isOpen={showConversations}
        onClose={() => setShowConversations(false)}
        onSelectSession={(id) => {
          setSearchParams({ session: id });
        }}
        onNewChat={handleNewChat}
        availableResources={availableResources}
      />
    </div>
  );
}
