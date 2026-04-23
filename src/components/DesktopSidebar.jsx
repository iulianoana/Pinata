import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { C } from "../styles/theme";
import { supabase } from "../lib/supabase.js";

const K = {
  activeBg: "#E8F8F3",
  activeText: "#0F6E56",
  activeIcon: "#1D9E75",
  primary: "#3ABFA0",
};

const NAV_ITEMS = [
  { id: "quizzes", label: "Quizzes", icon: "monitor" },
  { id: "lessons", label: "Lessons", icon: "bookOpen" },
  { id: "vocabulary", label: "Vocabulary", icon: "languages" },
  { id: "conjugar", label: "Conjugar", icon: "conjugar" },
  { id: "history", label: "History", icon: "clock" },
];

const ICONS = {
  monitor: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  clock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  bookOpen: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  chatBubble: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  phone: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  languages: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" />
    </svg>
  ),
  conjugar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" /><path d="M14 17h7M14 14h7M14 20h7" />
    </svg>
  ),
  fileEdit: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  ),
};

export default function DesktopSidebar({ session }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [inProgressCount, setInProgressCount] = useState(0);

  // Fetch quiz count
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase.from("quiz_progress").select("quiz_id")
      .eq("user_id", session.user.id).eq("status", "in_progress")
      .then(({ data }) => { if (data) setInProgressCount(data.length); });
  }, [session?.user?.id]);

  // Navigation helpers
  const getActiveLearnId = () => {
    if (location.pathname === "/lessons" || location.pathname.startsWith("/lesson/")) return "lessons";
    if (location.pathname === "/vocabulary") return "vocabulary";
    if (location.pathname.startsWith("/conjugar")) return "conjugar";
    if (location.pathname === "/history" || location.pathname === "/history/view") return "history";
    if (location.pathname === "/storage") return "storage";
    if (location.pathname === "/settings") return "settings";
    if (location.pathname === "/prompts") return "prompts";
    if (location.pathname === "/carolina" || location.pathname === "/dialog") return null;
    return "quizzes";
  };

  const handleLearnClick = (id) => {
    if (id === "lessons") navigate("/lessons");
    else if (id === "vocabulary") navigate("/vocabulary");
    else if (id === "conjugar") navigate("/conjugar");
    else if (id === "history") navigate("/history");
    else if (id === "storage") navigate("/storage");
    else if (id === "settings") navigate("/settings");
    else if (id === "prompts") navigate("/prompts");
    else navigate("/");
  };

  const handleChatClick = () => {
    // If already on /carolina, signal a reset to the screen (clear session query + state)
    if (location.pathname === "/carolina") {
      window.dispatchEvent(new CustomEvent("carolina-reset"));
    }
    navigate("/carolina");
  };
  const handleCallClick = () => navigate("/dialog");

  const isChatActive = location.pathname === "/carolina";
  const isCallActive = location.pathname === "/dialog";

  const activeLearnId = getActiveLearnId();

  const renderLearnItem = (item) => {
    const active = activeLearnId === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleLearnClick(item.id)}
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          padding: "8px 12px", borderRadius: 8, border: "none",
          background: active ? K.activeBg : "transparent",
          color: active ? C.accent : C.muted,
          fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700,
          cursor: "pointer", transition: "background 0.15s", textAlign: "left",
        }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#F0FAF8"; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ display: "flex", flexShrink: 0 }}>{ICONS[item.icon]}</span>
        <span style={{ flex: 1 }}>{item.label}</span>
      </button>
    );
  };

  const renderCarolinaButton = ({ label, icon, active, onClick }) => (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "8px 12px", borderRadius: 8, border: "none",
        background: active ? K.activeBg : "transparent",
        color: active ? K.activeText : C.muted,
        fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700,
        cursor: "pointer", transition: "background 0.15s", textAlign: "left",
        marginBottom: 4,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#F0FAF8"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ display: "flex", flexShrink: 0, color: active ? K.activeIcon : C.muted }}>
        {ICONS[icon]}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );

  return (
    <aside className="desktop-sidebar" style={{
      width: 220, minWidth: 220, height: "100vh", position: "fixed", top: 0, left: 0,
      background: C.card, borderRight: `0.5px solid ${C.border}`,
      display: "flex", flexDirection: "column",
      fontFamily: "'Nunito', sans-serif", zIndex: 30,
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 16px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <img src="/icons/logo.png" alt="Piñata" style={{ width: 32, height: 32, borderRadius: 8 }} />
        <span style={{ fontSize: 18, fontWeight: 900, color: C.text }}>Piñata</span>
      </div>

      {/* Learn section */}
      <div style={{ padding: "0 12px", flexShrink: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase",
          letterSpacing: "0.08em", padding: "12px 12px 6px",
        }}>Learn</div>
        {NAV_ITEMS.map(renderLearnItem)}
      </div>

      {/* Divider */}
      <div style={{ margin: "8px 16px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }} />

      {/* Carolina section */}
      <div style={{ padding: "0 12px", flexShrink: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase",
          letterSpacing: "0.08em", padding: "4px 12px 6px",
        }}>Carolina</div>

        {renderCarolinaButton({
          label: "Carolina Chat",
          icon: "chatBubble",
          active: isChatActive,
          onClick: handleChatClick,
        })}
        {renderCarolinaButton({
          label: "Call Carolina",
          icon: "phone",
          active: isCallActive,
          onClick: handleCallClick,
        })}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1, minHeight: 0 }} />

      {/* Bottom section */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px", flexShrink: 0 }}>
        {renderLearnItem({ id: "prompts", label: "Prompts", icon: "fileEdit" })}
        {renderLearnItem({ id: "settings", label: "Settings", icon: "settings" })}
        {renderLearnItem({ id: "storage", label: "Offline Storage", icon: "settings" })}

        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginTop: 4,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: C.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 14, fontWeight: 800,
          }}>I</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Iulian</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>
              Unit 1 {"·"} {inProgressCount} lesson{inProgressCount !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
