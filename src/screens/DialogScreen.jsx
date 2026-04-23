import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../styles/theme";
import { useInstantMode } from "../lib/useInstantMode";
import { useChatHistory } from "../lib/useChatHistory";
import { fetchCarolinaResources, fetchLesson } from "../lib/api";
import { ResourcePicker, ResourcePills } from "../components/ResourcePicker";
import { Switch } from "@/components/ui/switch";

// Blue accent for orb & session UI
const B = {
  primary: "#4285F4",
  light: "#E8F0FE",
  dark: "#1A73E8",
  ring: "rgba(66, 133, 244, 0.12)",
};

// Green accent for the user's turn in chat-in-turns mode
const G = {
  primary: "#34A853",
  ring: "rgba(52, 168, 83, 0.12)",
};

const CHAT_IN_TURNS_KEY = "pinata.carolina.chatInTurns";

const formatTime = (s) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function formatSessionDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sessionDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (sessionDay.getTime() === today.getTime()) return `Today, ${time}`;
  if (sessionDay.getTime() === yesterday.getTime()) return `Yesterday, ${time}`;
  const monthDay = date.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${monthDay}, ${time}`;
}

export default function DialogScreen({ session }) {
  const navigate = useNavigate();
  const [availableResources, setAvailableResources] = useState([]);  // weeks with nested lessons
  const [attachedResources, setAttachedResources] = useState([]);   // [{type,id,label}]
  const [selectedResourceIds, setSelectedResourceIds] = useState({}); // picker selection state
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptEndRef = useRef(null);

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [historySessions, setHistorySessions] = useState([]);
  const [viewingSession, setViewingSession] = useState(null);
  const [historyCount, setHistoryCount] = useState(0);

  // Chat-in-turns toggle (pre-call). Persisted per-device. Snapshotted at startSession.
  const [chatInTurns, setChatInTurns] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(CHAT_IN_TURNS_KEY);
    return v === null ? true : v === "true";
  });
  const [activeTurnMode, setActiveTurnMode] = useState(false);

  const instant = useInstantMode();
  const chatHistory = useChatHistory();
  const saveTimerRef = useRef(null);
  const lastSavedLenRef = useRef(0);

  const userId = session?.user?.id;

  // Load history count on mount
  useEffect(() => {
    if (!userId) return;
    chatHistory.getHistory(userId).then((sessions) => {
      setHistoryCount(sessions.length);
    });
  }, [userId]);

  // Load weeks + lessons from database
  useEffect(() => {
    fetchCarolinaResources()
      .then((data) => setAvailableResources(data))
      .catch(() => {});
  }, []);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    if (showTranscript && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [instant.transcript, showTranscript]);

  // Debounced save transcript to Supabase
  useEffect(() => {
    const done = instant.transcript.filter((m) => m.done || m.role === "model");
    if (done.length === 0 || done.length === lastSavedLenRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const clean = instant.transcript
        .filter((m) => m.text && m.text !== "...")
        .map((m) => ({ role: m.role, text: m.text }));
      chatHistory.saveTranscript(clean, clean.length);
      lastSavedLenRef.current = done.length;
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [instant.transcript]);

  // Reset saved length ref when session ends
  useEffect(() => {
    if (!instant.isSessionActive && !instant.isConnecting) {
      lastSavedLenRef.current = 0;
      setActiveTurnMode(false);
    }
  }, [instant.isSessionActive, instant.isConnecting]);

  const handleToggleResource = (lessonId, label) => {
    setSelectedResourceIds((prev) => {
      const next = { ...prev };
      if (lessonId in next) delete next[lessonId];
      else next[lessonId] = label;
      return next;
    });
  };

  const handleAttachResources = () => {
    const newResources = Object.entries(selectedResourceIds).map(
      ([id, label]) => ({ type: "lesson", id, label })
    );
    setAttachedResources(newResources);
    setShowResourcePicker(false);
  };

  const handleRemoveResource = (id) => {
    setAttachedResources((prev) => prev.filter((r) => r.id !== id));
    setSelectedResourceIds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleStartInstant = async () => {
    // Fetch markdown content for all attached lessons
    let unitContext = null;
    if (attachedResources.length > 0) {
      const parts = [];
      for (const r of attachedResources) {
        try {
          const lesson = await fetchLesson(r.id);
          if (lesson.markdown_content) {
            parts.push(`## ${lesson.title}\n\n${lesson.markdown_content}`);
          }
        } catch {}
      }
      if (parts.length > 0) unitContext = parts.join("\n\n---\n\n");
    }

    const displayName = attachedResources.length > 0
      ? attachedResources.map((r) => r.label).join(", ")
      : "Free conversation";

    if (userId) {
      await chatHistory.startChatSession(userId, displayName, attachedResources);
    }
    setActiveTurnMode(chatInTurns);
    instant.startSession(unitContext, { turnMode: chatInTurns });
  };

  const handleToggleChatInTurns = (next) => {
    setChatInTurns(next);
    try {
      window.localStorage.setItem(CHAT_IN_TURNS_KEY, String(next));
    } catch {}
  };

  const handleEndCall = () => {
    const clean = instant.transcript
      .filter((m) => m.text && m.text !== "...")
      .map((m) => ({ role: m.role, text: m.text }));
    chatHistory.endChatSession(instant.sessionDuration, clean, clean.length);
    instant.endSession();
    // Refresh history count
    if (userId) {
      chatHistory.getHistory(userId).then((sessions) => {
        setHistoryCount(sessions.length);
      });
    }
  };

  const handleOpenHistory = async () => {
    if (!userId) return;
    const sessions = await chatHistory.getHistory(userId);
    setHistorySessions(sessions);
    setViewingSession(null);
    setShowHistory(true);
  };

  const handleViewSession = async (sessionId) => {
    const data = await chatHistory.getSession(sessionId);
    if (data) setViewingSession(data);
  };

  const messageCount = instant.transcript.length;
  const isPreCall = !instant.isSessionActive && !instant.isConnecting;
  const isConnecting = !instant.isSessionActive && instant.isConnecting;
  const isActive = instant.isSessionActive;

  // Turn-mode derived state — only meaningful while a turn-mode session is active.
  const isUserTurn = activeTurnMode && !instant.isAISpeaking && !instant.isMuted;
  const accentPrimary = isUserTurn ? G.primary : B.primary;
  const accentRing = isUserTurn ? G.ring : B.ring;
  const accentSoft = isUserTurn
    ? "rgba(52,168,83,0.05)"
    : "rgba(66,133,244,0.05)";

  return (
    <div
      className="fade-in desktop-main"
      style={{
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        className="safe-top"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: C.bg,
          padding: "16px 20px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        {/* Mobile: plain back arrow + title */}
        <div className="quiz-home-btn" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              minWidth: 44,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke={C.text}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: C.text }}>
            {isPreCall ? "Hablar" : "Carolina"}
          </h1>
        </div>

        {/* Desktop: styled back button + title */}
        <div className="quiz-desktop-header" style={{ display: "none", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/")} style={{
            background: "none", border: `1.5px solid ${C.border}`, borderRadius: 10,
            color: C.muted, cursor: "pointer", padding: "6px 8px",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; e.currentTarget.style.borderColor = C.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: C.text }}>
            {isPreCall ? "Hablar" : "Carolina"}
          </h1>
        </div>

        {/* Timer (active session only) */}
        {isActive && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: B.primary,
                animation: "dotBlink 1.5s infinite ease-in-out",
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
              {formatTime(instant.sessionDuration)}
            </span>
          </div>
        )}
      </div>


      {/* ============ PRE-CALL VIEW ============ */}
      {isPreCall && (
        <>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            {/* Carolina avatar */}
            <div
              style={{
                width: 152,
                height: 152,
                borderRadius: "50%",
                overflow: "hidden",
                marginBottom: 20,
                boxShadow: `0 0 0 12px ${B.ring}, 0 0 0 24px rgba(66,133,244,0.05)`,
              }}
            >
              <img
                src="/images/Carolina.png"
                alt="Carolina"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
            <p
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: C.text,
                marginBottom: 4,
              }}
            >
              Carolina
            </p>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: C.muted,
                marginBottom: 28,
              }}
            >
              Your Spanish practice buddy
            </p>

            {/* Attached lesson pills */}
            <ResourcePills resources={attachedResources} onRemove={handleRemoveResource} />

            {/* Add lessons button + picker anchor */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowResourcePicker((v) => !v)}
                style={{
                  padding: "8px 20px",
                  borderRadius: 20,
                  border: `2px solid ${C.accent}`,
                  backgroundColor: C.card,
                  color: C.text,
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "'Nunito', sans-serif",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {attachedResources.length > 0
                  ? `${attachedResources.length} lesson${attachedResources.length !== 1 ? "s" : ""} attached`
                  : "Add lessons"}
              </button>

              {/* Resource picker — desktop: floating card anchored to button; mobile: bottom sheet */}
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
            </div>

            {/* Chat-in-turns toggle */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleToggleChatInTurns(!chatInTurns)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleToggleChatInTurns(!chatInTurns);
                }
              }}
              style={{
                marginTop: 16,
                width: "100%",
                maxWidth: 320,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${C.border}`,
                background: C.card,
                cursor: "pointer",
                fontFamily: "'Nunito', sans-serif",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: G.ring,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <TurnsIcon size={18} color={G.primary} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
                  Chat in turns
                </p>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 2 }}>
                  No 1.5s silence cutoffs
                </p>
              </div>
              <Switch
                checked={chatInTurns}
                onCheckedChange={handleToggleChatInTurns}
                onClick={(e) => e.stopPropagation()}
                aria-label="Chat in turns"
              />
            </div>

          </div>

          {/* Call button + history shortcut */}
          <div
            style={{
              padding: "16px 20px 32px",
              textAlign: "center",
              paddingBottom: "max(32px, env(safe-area-inset-bottom, 32px))",
            }}
          >
            <div style={{ position: "relative", display: "inline-block" }}>
              <button
                onClick={handleStartInstant}
                aria-label="Call Carolina"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  background: "#34A853",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 16px rgba(52,168,83,0.3)",
                  transition: "transform 0.15s",
                }}
              >
                <PhoneIcon size={28} color="#fff" />
              </button>
              {historyCount > 0 && (
                <button
                  onClick={handleOpenHistory}
                  aria-label={`Past conversations (${historyCount})`}
                  title={`Past conversations (${historyCount})`}
                  style={{
                    position: "absolute",
                    left: "100%",
                    top: "50%",
                    transform: "translate(20px, -50%)",
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    border: `1px solid ${C.border}`,
                    background: C.card,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "border-color 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.muted; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
                >
                  <ClockIcon size={18} color={C.muted} />
                </button>
              )}
            </div>
            <p
              style={{
                color: C.muted,
                fontSize: 13,
                fontWeight: 600,
                marginTop: 12,
              }}
            >
              Tap to call Carolina
            </p>
          </div>
        </>
      )}

      {/* ============ CONNECTING VIEW ============ */}
      {isConnecting && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: 152,
              height: 152,
              borderRadius: "50%",
              overflow: "hidden",
              marginBottom: 28,
              animation: "orbPulse 1.5s infinite ease-in-out",
              boxShadow: `0 0 0 12px ${B.ring}, 0 0 0 24px rgba(66,133,244,0.05)`,
            }}
          >
            <img
              src="/images/Carolina.png"
              alt="Carolina"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
          <p
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: C.text,
              marginBottom: 6,
            }}
          >
            Calling Carolina...
          </p>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>
            Setting up your session
          </p>
        </div>
      )}

      {/* ============ ACTIVE SESSION ============ */}
      {isActive && (
        <>
          {/* Orb area */}
          <div
            style={{
              flex: showTranscript && isMobile ? "none" : 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: showTranscript && isMobile ? "12px 20px" : 20,
              transition: "padding 0.3s",
            }}
          >
            {/* Orb with rings */}
            <div
              style={{
                position: "relative",
                width: showTranscript && isMobile ? 80 : 200,
                height: showTranscript && isMobile ? 80 : 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: showTranscript && isMobile ? 8 : 24,
                transition: "all 0.3s",
              }}
            >
              {/* Expanding rings (hidden when transcript open on mobile) */}
              {!(showTranscript && isMobile) &&
                [0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      width: 152,
                      height: 152,
                      borderRadius: "50%",
                      border: `2px solid ${accentPrimary}`,
                      opacity: 0,
                      animation: `ringExpand 2.4s ${i * 0.8}s infinite ease-out`,
                      transition: "border-color 0.3s",
                    }}
                  />
                ))}

              {/* Main orb */}
              <div
                style={{
                  width: showTranscript && isMobile ? 64 : 152,
                  height: showTranscript && isMobile ? 64 : 152,
                  borderRadius: "50%",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: showTranscript && isMobile ? "none" : `0 0 0 12px ${accentRing}, 0 0 0 24px ${accentSoft}`,
                  animation: instant.isAISpeaking
                    ? "none"
                    : "orbPulse 3s infinite ease-in-out",
                  transition: "box-shadow 0.3s",
                  zIndex: 1,
                }}
              >
                <img
                  src="/images/Carolina.png"
                  alt="Carolina"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
              {/* Speaking wave overlay */}
              {instant.isAISpeaking && (
                <div
                  style={{
                    position: "absolute",
                    zIndex: 2,
                    display: "flex",
                    gap: 3,
                    alignItems: "center",
                    height: showTranscript && isMobile ? 24 : 36,
                  }}
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 4,
                        borderRadius: 2,
                        background: "#fff",
                        animation: `waveBar 0.6s ${i * 0.1}s infinite ease-in-out alternate`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Status text */}
            <p
              style={{
                fontSize: showTranscript && isMobile ? 16 : 20,
                fontWeight: 800,
                color: instant.isAISpeaking
                  ? B.primary
                  : isUserTurn
                    ? G.primary
                    : C.text,
                marginBottom: showTranscript && isMobile ? 0 : 4,
                transition: "color 0.2s",
              }}
            >
              {activeTurnMode
                ? instant.isAISpeaking
                  ? "Carolina is speaking..."
                  : isUserTurn
                    ? "Your turn"
                    : "Your mic is off"
                : instant.isMuted && !instant.isAISpeaking
                  ? "Your mic is off"
                  : instant.isAISpeaking
                    ? "Carolina is speaking..."
                    : "Listening..."}
            </p>
            {!(showTranscript && isMobile) && (
              <p style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>
                {activeTurnMode
                  ? instant.isAISpeaking
                    ? "Your turn is next"
                    : isUserTurn
                      ? "Speak freely — tap ✓ when done"
                      : "Tap mic to talk"
                  : instant.isMuted
                    ? instant.isAISpeaking
                      ? "Won't interrupt"
                      : "Tap mic to talk"
                    : instant.isAISpeaking
                      ? "Interrupt anytime"
                      : "Just speak naturally"}
              </p>
            )}
          </div>

          {/* Transcript panel — slide-up on mobile, right side panel on desktop */}
          {showTranscript && (
            <div
              style={{
                background: C.card,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                ...(isMobile
                  ? {
                      flex: 1,
                      borderTop: `1px solid ${C.border}`,
                      borderRadius: "16px 16px 0 0",
                      animation: "sheetUp 0.3s ease-out",
                    }
                  : {
                      position: "fixed",
                      top: 16,
                      right: 16,
                      bottom: 16,
                      width: 420,
                      zIndex: 30,
                      border: `1px solid ${C.border}`,
                      borderRadius: 16,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                      animation: "sheetSlideRight 0.3s ease-out",
                    }),
              }}
            >
              {/* Panel header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: C.muted,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Transcript
                </span>
                <button
                  onClick={() => setShowTranscript(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 800,
                    color: B.primary,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 0",
                  }}
                >
                  HIDE ✕
                </button>
              </div>

              {/* Messages */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "12px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {instant.transcript.map((msg, i) => {
                  const isUser = msg.role === "user";
                  const isFirstInSequence =
                    i === 0 || instant.transcript[i - 1].role !== msg.role;

                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isUser ? "flex-end" : "flex-start",
                      }}
                    >
                      {/* Carolina label above her messages */}
                      {!isUser && isFirstInSequence && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: C.muted,
                            marginBottom: 4,
                          }}
                        >
                          Carolina
                        </span>
                      )}

                      {/* Chat bubble */}
                      <div
                        style={{
                          maxWidth: "80%",
                          padding: "10px 14px",
                          borderRadius: 16,
                          background: isUser ? C.accent : "#F1F3F4",
                          color: isUser ? "#fff" : C.text,
                          fontSize: 14,
                          fontWeight: 600,
                          lineHeight: 1.5,
                          borderBottomRightRadius: isUser ? 4 : 16,
                          borderBottomLeftRadius: isUser ? 16 : 4,
                        }}
                      >
                        {msg.text}
                      </div>

                      {/* Iulian label below his messages */}
                      {isUser && isFirstInSequence && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: C.muted,
                            marginTop: 4,
                          }}
                        >
                          Iulian
                        </span>
                      )}
                    </div>
                  );
                })}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          )}

          {/* Bottom controls */}
          <div
            style={{
              position: "relative",
              padding: "16px 20px 32px",
              textAlign: "center",
              paddingBottom: "max(32px, env(safe-area-inset-bottom, 32px))",
            }}
          >
            {/* Mobile-only floating transcript toggle (top-right) */}
            {!showTranscript && isMobile && (
              <button
                onClick={() => setShowTranscript(true)}
                style={{
                  position: "absolute",
                  right: 20,
                  top: 8,
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: `1px solid ${C.border}`,
                  background: C.card,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChatBubbleIcon size={20} color={C.muted} />
                {messageCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      minWidth: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: B.primary,
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 4px",
                    }}
                  >
                    {messageCount > 99 ? "99" : messageCount}
                  </span>
                )}
              </button>
            )}

            {/* Done speaking pill — only in turn mode, only on user's turn */}
            {isUserTurn && (
              <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
                <button
                  onClick={instant.endTurn}
                  aria-label="Done speaking"
                  style={{
                    minWidth: 220,
                    padding: "14px 28px",
                    borderRadius: 999,
                    border: "none",
                    cursor: "pointer",
                    background: G.primary,
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 800,
                    fontFamily: "'Nunito', sans-serif",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    boxShadow: "0 6px 20px rgba(52,168,83,0.35)",
                    transition: "transform 0.1s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 24px rgba(52,168,83,0.45)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(52,168,83,0.35)"; }}
                >
                  <CheckCircleIcon size={20} color="#fff" />
                  Done speaking
                </button>
              </div>
            )}

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 24,
              }}
            >
              {/* Mute button */}
              <button
                onClick={instant.toggleMute}
                aria-label={instant.isMuted ? "Unmute microphone" : "Mute microphone"}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  background: instant.isMuted ? B.primary : "#F1F3F4",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: instant.isMuted
                    ? "0 4px 16px rgba(66,133,244,0.3)"
                    : "none",
                  transition: "background 0.15s, box-shadow 0.15s",
                }}
              >
                <MicIcon
                  muted={instant.isMuted}
                  color={instant.isMuted ? "#fff" : C.text}
                />
              </button>

              {/* End call */}
              <button
                onClick={handleEndCall}
                aria-label="End call"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  background: C.error,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 16px rgba(255,101,132,0.3)",
                  transition: "transform 0.15s",
                }}
              >
                {/* End call icon (rotated phone) */}
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: "rotate(135deg)" }}
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </button>

              {/* Desktop-only transcript toggle (lives next to End in the row) */}
              {!isMobile && (
                <button
                  onClick={() => setShowTranscript((v) => !v)}
                  aria-label={showTranscript ? "Hide transcript" : "Show transcript"}
                  style={{
                    position: "relative",
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    border: `1px solid ${C.border}`,
                    background: showTranscript ? B.light : C.card,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.15s",
                  }}
                >
                  <ChatBubbleIcon
                    size={22}
                    color={showTranscript ? B.primary : C.muted}
                  />
                  {messageCount > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: -2,
                        right: -2,
                        minWidth: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: B.primary,
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 4px",
                      }}
                    >
                      {messageCount > 99 ? "99" : messageCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Error toast */}
      {instant.error && (
        <div
          style={{
            position: "fixed",
            bottom: 180,
            left: "50%",
            transform: "translateX(-50%)",
            background: C.errorLight,
            border: `1px solid ${C.error}`,
            borderRadius: 12,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 700,
            color: "#B91C45",
            maxWidth: 340,
            textAlign: "center",
            zIndex: 30,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          {instant.error}
          <button
            onClick={instant.clearError}
            style={{
              background: "none",
              border: "none",
              color: "#B91C45",
              fontWeight: 800,
              marginLeft: 8,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ============ HISTORY SHEET — bottom on mobile, right on desktop ============ */}
      {showHistory && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "flex-end",
          }}
          onClick={() => { setShowHistory(false); setViewingSession(null); }}
        >
          {/* Dimmed backdrop */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: C.overlay,
              animation: "overlayFade 0.2s ease-out",
            }}
          />

          {/* Sheet */}
          <div
            style={{
              position: "relative",
              background: C.card,
              display: "flex",
              flexDirection: "column",
              ...(isMobile
                ? {
                    borderRadius: "20px 20px 0 0",
                    maxHeight: viewingSession ? "100vh" : "70vh",
                    height: viewingSession ? "100%" : "auto",
                    animation: "sheetUp 0.3s ease-out",
                  }
                : {
                    borderRadius: "20px 0 0 20px",
                    width: 440,
                    height: "100vh",
                    maxHeight: "100vh",
                    boxShadow: "-8px 0 24px rgba(0,0,0,0.08)",
                    animation: "sheetSlideRight 0.3s ease-out",
                  }),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 20px 16px",
                borderBottom: `1px solid ${C.border}`,
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {viewingSession && (
                  <button
                    onClick={() => setViewingSession(null)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={C.text}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                )}
                <h2 style={{ fontSize: 18, fontWeight: 900, color: C.text }}>
                  {viewingSession ? viewingSession.unit_name : "Past conversations"}
                </h2>
              </div>
              <button
                onClick={() => { setShowHistory(false); setViewingSession(null); }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 800,
                  color: B.primary,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 0",
                }}
              >
                Close ✕
              </button>
            </div>

            {/* Transcript meta line */}
            {viewingSession && (
              <div
                style={{
                  padding: "10px 20px",
                  textAlign: "center",
                  borderBottom: `1px solid ${C.border}`,
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>
                  {formatSessionDate(viewingSession.started_at)}
                  {" · "}
                  {Math.max(1, Math.round(viewingSession.duration_seconds / 60))} min
                  {" · "}
                  {viewingSession.turn_count} turns
                </span>
              </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              {!viewingSession ? (
                /* Session list */
                <div style={{ padding: "8px 0" }}>
                  {historySessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleViewSession(s.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        width: "100%",
                        padding: "14px 20px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "'Nunito', sans-serif",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C.bg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      {/* Chat icon */}
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: B.light,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <ChatBubbleIcon size={18} color={B.primary} />
                      </div>

                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: C.text,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.unit_name}
                        </p>
                        <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 2 }}>
                          {formatSessionDate(s.started_at)}
                          {" · "}
                          {Math.max(1, Math.round(s.duration_seconds / 60))} min
                          {" · "}
                          {s.turn_count} turns
                        </p>
                      </div>

                      {/* Chevron */}
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={C.muted}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0 }}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  ))}
                </div>
              ) : (
                /* Transcript view */
                <div
                  style={{
                    padding: "12px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {(viewingSession.transcript || []).map((msg, i) => {
                    const isUser = msg.role === "user";
                    const transcript = viewingSession.transcript || [];
                    const isFirstInSequence =
                      i === 0 || transcript[i - 1].role !== msg.role;

                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: isUser ? "flex-end" : "flex-start",
                        }}
                      >
                        {!isUser && isFirstInSequence && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: C.muted,
                              marginBottom: 4,
                            }}
                          >
                            Carolina
                          </span>
                        )}

                        <div
                          style={{
                            maxWidth: "80%",
                            padding: "10px 14px",
                            borderRadius: 16,
                            background: isUser ? C.accent : "#F1F3F4",
                            color: isUser ? "#fff" : C.text,
                            fontSize: 14,
                            fontWeight: 600,
                            lineHeight: 1.5,
                            borderBottomRightRadius: isUser ? 4 : 16,
                            borderBottomLeftRadius: isUser ? 16 : 4,
                          }}
                        >
                          {msg.text}
                        </div>

                        {isUser && isFirstInSequence && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: C.muted,
                              marginTop: 4,
                            }}
                          >
                            Iulian
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes waveBar {
          from { height: 6px; }
          to { height: 24px; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes ringExpand {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes dotBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sheetSlideRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

/* ---- Small helper components ---- */

function HeadphonesIcon({ size = 28, color = "#fff" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}

function PhoneIcon({ size = 28, color = "#fff" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function ChatBubbleIcon({ size = 20, color = "#999" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MicIcon({ muted = false, size = 22, color = "#1f2937" }) {
  if (muted) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="2" y1="2" x2="22" y2="22" />
        <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
        <path d="M5 10v2a7 7 0 0 0 12 5" />
        <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function ClockIcon({ size = 14, color = "#4285F4" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function TurnsIcon({ size = 18, color = "#34A853" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function CheckCircleIcon({ size = 20, color = "#fff" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
