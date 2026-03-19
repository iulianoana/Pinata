import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../styles/theme";
import { useInstantMode } from "../lib/useInstantMode";

// Blue accent for orb & session UI
const B = {
  primary: "#4285F4",
  light: "#E8F0FE",
  dark: "#1A73E8",
  ring: "rgba(66, 133, 244, 0.12)",
};

const formatTime = (s) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function DialogScreen() {
  const navigate = useNavigate();
  const [currentUnit, setCurrentUnit] = useState(null);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptEndRef = useRef(null);

  const instant = useInstantMode();

  // Discover available units
  useEffect(() => {
    const units = [];
    (async () => {
      for (let i = 1; i <= 20; i++) {
        const num = String(i).padStart(2, "0");
        try {
          const res = await fetch(`/units/unit-${num}.md`, { method: "HEAD" });
          const ct = res.headers.get("content-type") || "";
          if (res.ok && !ct.startsWith("text/html")) units.push(`unit-${num}`);
          else break;
        } catch {
          break;
        }
      }
      setAvailableUnits(units);
    })();
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    if (showTranscript && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [instant.transcript, showTranscript]);

  const handleUnitChange = async (unitId) => {
    if (unitId === selectedUnit) return;
    setSelectedUnit(unitId);
    if (!unitId) {
      setCurrentUnit(null);
      return;
    }
    try {
      const res = await fetch(`/units/${unitId}.md`);
      if (res.ok) setCurrentUnit(await res.text());
    } catch {}
  };

  const handleStartInstant = () => {
    instant.startSession(currentUnit || null);
  };

  const unitLabel = (id) => `Unit ${parseInt(id.replace("unit-", ""), 10)}`;

  const messageCount = instant.transcript.length;
  const isPreCall = !instant.isSessionActive && !instant.isConnecting;
  const isConnecting = !instant.isSessionActive && instant.isConnecting;
  const isActive = instant.isSessionActive;

  return (
    <div
      className="fade-in"
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
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: C.bg,
          padding: "16px 20px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

      {/* Header spacer */}
      <div
        style={{
          height: 68,
          marginTop: "max(16px, env(safe-area-inset-top, 16px))",
        }}
      />

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

            {/* Unit selector */}
            <UnitDropdown
              units={availableUnits}
              selected={selectedUnit}
              onChange={handleUnitChange}
              unitLabel={unitLabel}
            />
          </div>

          {/* Call button */}
          <div
            style={{
              padding: "16px 20px 32px",
              textAlign: "center",
              paddingBottom: "max(32px, env(safe-area-inset-bottom, 32px))",
            }}
          >
            <button
              onClick={handleStartInstant}
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
              flex: showTranscript ? "none" : 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: showTranscript ? "12px 20px" : 20,
              transition: "padding 0.3s",
            }}
          >
            {/* Orb with rings */}
            <div
              style={{
                position: "relative",
                width: showTranscript ? 80 : 200,
                height: showTranscript ? 80 : 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: showTranscript ? 8 : 24,
                transition: "all 0.3s",
              }}
            >
              {/* Expanding rings (hidden when transcript open) */}
              {!showTranscript &&
                [0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      width: 152,
                      height: 152,
                      borderRadius: "50%",
                      border: `2px solid ${B.primary}`,
                      opacity: 0,
                      animation: `ringExpand 2.4s ${i * 0.8}s infinite ease-out`,
                    }}
                  />
                ))}

              {/* Main orb */}
              <div
                style={{
                  width: showTranscript ? 64 : 152,
                  height: showTranscript ? 64 : 152,
                  borderRadius: "50%",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: showTranscript ? "none" : `0 0 0 12px ${B.ring}, 0 0 0 24px rgba(66,133,244,0.05)`,
                  animation: instant.isAISpeaking
                    ? "none"
                    : "orbPulse 3s infinite ease-in-out",
                  transition: "all 0.3s",
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
                    height: showTranscript ? 24 : 36,
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
                fontSize: showTranscript ? 16 : 20,
                fontWeight: 800,
                color: instant.isAISpeaking ? B.primary : C.text,
                marginBottom: showTranscript ? 0 : 4,
                transition: "all 0.2s",
              }}
            >
              {instant.isAISpeaking
                ? "Carolina is speaking..."
                : "Listening..."}
            </p>
            {!showTranscript && (
              <p style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>
                {instant.isAISpeaking
                  ? "Interrupt anytime"
                  : "Just speak naturally"}
              </p>
            )}
          </div>

          {/* Transcript panel (slide-up) */}
          {showTranscript && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                background: C.card,
                borderTop: `1px solid ${C.border}`,
                borderRadius: "16px 16px 0 0",
                overflow: "hidden",
                animation: "sheetUp 0.3s ease-out",
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
            {/* Transcript toggle (bottom right, hidden when transcript open) */}
            {!showTranscript && (
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

            <p
              style={{
                color: C.muted,
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              Tap to end session
            </p>
            <button
              onClick={instant.endSession}
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
      `}</style>
    </div>
  );
}

/* ---- Small helper components ---- */

function UnitDropdown({ units, selected, onChange, unitLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, []);

  const displayLabel = selected ? unitLabel(selected) : "Free conversation";

  const options = [
    { id: null, label: "Free conversation" },
    ...units.map((u) => ({ id: u, label: unitLabel(u) })),
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "8px 32px 8px 16px",
          borderRadius: 20,
          border: `2px solid ${C.accent}`,
          backgroundColor: C.card,
          color: C.text,
          fontSize: 14,
          fontWeight: 700,
          fontFamily: "'Nunito', sans-serif",
          cursor: "pointer",
          position: "relative",
          transition: "all 0.2s",
        }}
      >
        {displayLabel}
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: `translateY(-50%) rotate(${open ? "180deg" : "0deg"})`,
            transition: "transform 0.2s",
          }}
        >
          <path
            d="M1 1L5 5L9 1"
            stroke={C.muted}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            minWidth: 180,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 50,
            overflow: "hidden",
            animation: "dropdownIn 0.15s ease-out",
          }}
        >
          {options.map((opt) => {
            const isActive = opt.id === selected;
            return (
              <button
                key={opt.id ?? "general"}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "10px 14px",
                  border: "none",
                  background: isActive ? C.accentLight : "transparent",
                  color: isActive ? C.accent : C.text,
                  fontSize: 13,
                  fontWeight: isActive ? 800 : 600,
                  fontFamily: "'Nunito', sans-serif",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = C.bg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isActive
                    ? C.accentLight
                    : "transparent";
                }}
              >
                {isActive && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={C.accent}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
