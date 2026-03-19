import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../styles/theme";
import { useInstantMode } from "../lib/useInstantMode";

// Blue accent for Instant mode
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
  const [selectedUnit, setSelectedUnit] = useState(null); // null = general chat

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
            Hablar
          </h1>
        </div>

        {/* Timer (session active) or Unit selector */}
        {instant.isSessionActive ? (
          <div
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: B.primary,
                animation: "dotBlink 1.5s infinite ease-in-out",
              }}
            />
            <span
              style={{ fontSize: 14, fontWeight: 700, color: C.text }}
            >
              {formatTime(instant.sessionDuration)}
            </span>
          </div>
        ) : (
          <UnitDropdown
            units={availableUnits}
            selected={selectedUnit}
            onChange={handleUnitChange}
            unitLabel={unitLabel}
          />
        )}
      </div>

      {/* Header spacer */}
      <div style={{ height: 68, marginTop: "max(16px, env(safe-area-inset-top, 16px))" }} />

      {/* ============ INSTANT MODE ============ */}
      {!instant.isSessionActive ? (
        /* ---------- Idle / Connecting state ---------- */
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
            {/* Static orb */}
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: B.light,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 28,
                boxShadow: `0 0 0 16px ${B.ring}, 0 0 0 32px rgba(66,133,244,0.05)`,
                opacity: instant.isConnecting ? 0.6 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {instant.isConnecting ? (
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={B.primary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{ animation: "spin 1s linear infinite" }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <HeadphonesIcon size={48} color={B.primary} />
              )}
            </div>
            <p
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: C.text,
                marginBottom: 6,
              }}
            >
              {instant.isConnecting
                ? "Connecting..."
                : "Start a conversation"}
            </p>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: C.muted,
                textAlign: "center",
                lineHeight: 1.6,
              }}
            >
              {instant.isConnecting
                ? "Setting up microphone and Gemini session..."
                : (
                  <>
                    {selectedUnit ? `Practicing ${unitLabel(selectedUnit)}` : "General conversation mode"}
                    <br />
                    Just speak naturally — no push-to-talk.
                  </>
                )}
            </p>
          </div>

          <div
            style={{
              padding: "16px 20px 32px",
              textAlign: "center",
              paddingBottom:
                "max(32px, env(safe-area-inset-bottom, 32px))",
            }}
          >
            <p
              style={{
                color: C.muted,
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              {instant.isConnecting
                ? "Please wait..."
                : "Tap to start session"}
            </p>
            <button
              onClick={handleStartInstant}
              disabled={instant.isConnecting}
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                border: "none",
                cursor: instant.isConnecting ? "default" : "pointer",
                background: B.primary,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(66,133,244,0.3)",
                transition: "transform 0.15s",
                opacity: instant.isConnecting ? 0.5 : 1,
              }}
            >
              {instant.isConnecting ? (
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{ animation: "spin 1s linear infinite" }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <HeadphonesIcon size={28} color="#fff" />
              )}
            </button>
          </div>
        </>
      ) : (
        /* ---------- Active session ---------- */
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
            {/* Animated orb with rings */}
            <div
              style={{
                position: "relative",
                width: 160,
                height: 160,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              {/* Expanding rings */}
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    width: 120,
                    height: 120,
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
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  background: instant.isAISpeaking
                    ? B.primary
                    : B.light,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: instant.isAISpeaking
                    ? "none"
                    : "orbPulse 3s infinite ease-in-out",
                  transition: "background 0.3s",
                  zIndex: 1,
                }}
              >
                {instant.isAISpeaking ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 3,
                      alignItems: "center",
                      height: 36,
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
                ) : (
                  <HeadphonesIcon size={48} color={B.primary} />
                )}
              </div>
            </div>

            {/* Status text */}
            <p
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: instant.isAISpeaking ? B.primary : C.text,
                marginBottom: 4,
                transition: "color 0.2s",
              }}
            >
              {instant.isAISpeaking ? "Speaking..." : "Listening..."}
            </p>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: C.muted,
              }}
            >
              {instant.isAISpeaking
                ? "Interrupt anytime"
                : "Just speak naturally"}
            </p>

            {/* Live transcript */}
            {instant.transcript.length > 0 && (
              <div
                style={{
                  marginTop: 24,
                  width: "100%",
                  maxWidth: 340,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: 12,
                  background: C.card,
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.muted,
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Live transcript
                </p>
                {instant.transcript.slice(-4).map((t, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      marginBottom: 4,
                      color:
                        t.role === "user" ? C.text : B.primary,
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>
                      {t.role === "user" ? "You: " : "AI: "}
                    </span>
                    {t.text}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* End session button */}
          <div
            style={{
              padding: "16px 20px 32px",
              textAlign: "center",
              paddingBottom:
                "max(32px, env(safe-area-inset-bottom, 32px))",
            }}
          >
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

  const displayLabel = selected ? unitLabel(selected) : "General";

  const options = [
    { id: null, label: "General" },
    ...units.map((u) => ({ id: u, label: unitLabel(u) })),
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "6px 28px 6px 12px",
          borderRadius: 10,
          border: `2px solid ${selected ? B.primary : C.border}`,
          backgroundColor: selected ? B.primary : C.card,
          color: selected ? "#fff" : C.text,
          fontSize: 13,
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
            right: 10,
            top: "50%",
            transform: `translateY(-50%) rotate(${open ? "180deg" : "0deg"})`,
            transition: "transform 0.2s",
          }}
        >
          <path
            d="M1 1L5 5L9 1"
            stroke={selected ? "#fff" : C.muted}
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
            right: 0,
            minWidth: 140,
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
                  background: isActive ? B.light : "transparent",
                  color: isActive ? B.primary : C.text,
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
                  e.currentTarget.style.background = isActive ? B.light : "transparent";
                }}
              >
                {isActive && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={B.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
