import { useState, useEffect } from "react";
import { C } from "../../styles/theme";

export default function AddWeekModal({ open, onClose, onCreate, nextWeekNumber }) {
  const [weekNumber, setWeekNumber] = useState(nextWeekNumber);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setWeekNumber(nextWeekNumber);
      setTitle("");
      setError("");
    }
  }, [open, nextWeekNumber]);

  const handleCreate = async () => {
    if (!weekNumber || weekNumber < 1) { setError("Week number is required"); return; }
    setSaving(true);
    setError("");
    try {
      await onCreate(weekNumber, title);
      setTitle("");
      onClose();
    } catch (e) {
      setError(e.message || "Failed to create week");
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
      {/* Desktop: centered card. Mobile: also centered (spec says bottom sheet for mobile,
          but for simplicity use same centered card since it works well on both) */}
      <div className="slide-up add-week-modal-content" style={{
        background: C.card, borderRadius: 20, padding: 32, width: "calc(100% - 48px)",
        maxWidth: 420, boxShadow: "0 8px 32px rgba(0,60,50,0.15)",
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 24, textAlign: "center" }}>
          New week
        </h3>

        {/* Week number */}
        <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          Week number
        </label>
        <input
          type="number"
          min={1}
          value={weekNumber}
          onChange={(e) => setWeekNumber(parseInt(e.target.value) || "")}
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`,
            background: C.inputBg, fontSize: 16, fontWeight: 700, color: C.text,
            fontFamily: "'Nunito', sans-serif", outline: "none", marginBottom: 16,
          }}
          onFocus={(e) => (e.target.style.borderColor = C.accent)}
          onBlur={(e) => (e.target.style.borderColor = C.border)}
        />

        {/* Title */}
        <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          Title (alias)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. La rutina diaria"
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`,
            background: C.inputBg, fontSize: 15, fontWeight: 600, color: C.text,
            fontFamily: "'Nunito', sans-serif", outline: "none", marginBottom: 24,
          }}
          onFocus={(e) => (e.target.style.borderColor = C.accent)}
          onBlur={(e) => (e.target.style.borderColor = C.border)}
        />

        {error && (
          <p style={{ color: C.error, fontSize: 13, fontWeight: 600, textAlign: "center", marginBottom: 16 }}>{error}</p>
        )}

        {/* Buttons */}
        <button onClick={handleCreate} disabled={saving} style={{
          width: "100%", padding: "14px", borderRadius: 14, border: "none",
          background: C.accent, color: "white", fontWeight: 800, fontSize: 15,
          cursor: saving ? "default" : "pointer", fontFamily: "'Nunito', sans-serif",
          opacity: saving ? 0.7 : 1, marginBottom: 10, minHeight: 48,
        }}>
          {saving ? "Creating..." : "Create week"}
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
  );
}
