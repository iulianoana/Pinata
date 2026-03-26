import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { C } from "../styles/theme";
import { SPANISH_TENSES } from "../lib/conjugar/constants";
import { usePack, regeneratePack } from "../lib/conjugar/api";
import {
  VerbTypeBadge, ScoreBadge, ExerciseTypeIcon,
  getExerciseMeta, getExercisePreview, timeAgo,
} from "../components/conjugar/shared";

export default function PackDetailScreen({ session }) {
  const { verbId, tense } = useParams();
  const navigate = useNavigate();
  const { pack, verb, isLoading, error, refresh } = usePack(verbId, tense);
  const [regenerating, setRegenerating] = useState(false);

  const tenseLabel = SPANISH_TENSES.find((t) => t.id === tense)?.label || tense;

  const handleRegenerate = async () => {
    if (!pack?.id || regenerating) return;
    setRegenerating(true);
    try {
      await regeneratePack(pack.id);
      refresh();
    } catch (e) {
      console.error("Regenerate failed:", e);
    } finally {
      setRegenerating(false);
    }
  };

  const handleStartDrill = () => {
    if (pack?.id) {
      navigate(`/conjugar/drill?packs=${pack.id}`);
    }
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="fade-in" style={{ minHeight: "100vh", background: C.bg }}>
        <div className="desktop-main lessons-page safe-top" style={{ paddingTop: 16 }}>
          <div className="skeleton" style={{ width: 200, height: 28, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 140, height: 18, marginBottom: 24 }} />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ width: "100%", height: 64, marginBottom: 8, borderRadius: 12 }} />
          ))}
        </div>

      </div>
    );
  }

  if (error || !pack || !verb) {
    return (
      <div className="fade-in" style={{ minHeight: "100vh", background: C.bg }}>
        <div className="desktop-main lessons-page safe-top" style={{ paddingTop: 16, textAlign: "center", padding: "60px 20px" }}>
          <p style={{ color: C.muted, fontSize: 15, fontWeight: 600 }}>
            {error || "Pack no encontrado."}
          </p>
          <button
            onClick={() => navigate("/conjugar")}
            style={{
              marginTop: 16, padding: "10px 22px", borderRadius: 12,
              border: `2px solid ${C.border}`, background: "transparent",
              color: C.text, fontSize: 14, fontWeight: 700, cursor: "pointer",
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            Volver a Conjugar
          </button>
        </div>

      </div>
    );
  }

  const exercises = pack.exercises || [];
  const verbPacks = verb.packs || [];
  const thisPackStats = verbPacks.find((p) => p.tense === tense);

  return (
    <div className="desktop-main">
      <div className="lessons-page fade-in safe-top" style={{ paddingTop: 16 }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          {/* Back + title row */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 4,
          }}>
            <button
              onClick={() => navigate("/conjugar")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: 4, display: "flex", color: C.text,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: C.text, fontFamily: "'Nunito', sans-serif" }}>
                  {verb.infinitive}
                </span>
                <VerbTypeBadge type={verb.verb_type} />
                <span style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>
                  {"\u00b7"} {tenseLabel}
                </span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.muted, margin: "2px 0 0" }}>
                {exercises.length} ejercicios
                {thisPackStats?.attemptCount > 0 && (
                  <> {"\u00b7"} {thisPackStats.attemptCount} intento{thisPackStats.attemptCount !== 1 ? "s" : ""}
                  {"\u00b7"} Última puntuación: {thisPackStats.lastPercentage}%</>
                )}
              </p>
            </div>

            {/* Action buttons (desktop) */}
            <div className="add-quiz-btn-desktop" style={{ display: "none", alignItems: "center", gap: 8 }}>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                style={{
                  padding: "10px 18px", borderRadius: 12,
                  border: `2px solid ${C.border}`, background: "transparent",
                  color: C.text, fontSize: 13, fontWeight: 700,
                  cursor: regenerating ? "not-allowed" : "pointer",
                  fontFamily: "'Nunito', sans-serif",
                  opacity: regenerating ? 0.6 : 1,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {regenerating ? (
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%",
                    border: `2px solid ${C.border}`, borderTopColor: C.accent,
                    animation: "spin 1s linear infinite",
                  }} />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                  </svg>
                )}
                Regenerar
              </button>
              <button
                onClick={handleStartDrill}
                style={{
                  padding: "10px 22px", borderRadius: 12, border: "none",
                  background: C.accent, color: "white", fontSize: 14, fontWeight: 800,
                  cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.accentHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = C.accent; }}
              >
                Practicar ahora
              </button>
            </div>
          </div>

          {/* Mobile action buttons */}
          <div className="add-quiz-btn-mobile" style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              style={{
                padding: "8px 16px", borderRadius: 10,
                border: `1.5px solid ${C.border}`, background: "transparent",
                color: C.text, fontSize: 13, fontWeight: 700,
                cursor: regenerating ? "not-allowed" : "pointer",
                fontFamily: "'Nunito', sans-serif",
                opacity: regenerating ? 0.6 : 1,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {"\u21bb"} Regenerar
            </button>
          </div>
        </div>

        {/* Exercise list */}
        <div className="pack-detail-grid" style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 10,
        }}>
          {exercises.map((exercise, idx) => (
            <ExerciseRow key={exercise.id || idx} exercise={exercise} index={idx + 1} />
          ))}
        </div>

        {/* Bottom spacer for mobile FAB + nav */}
        <div style={{ height: 120 }} />
      </div>

      {/* Mobile FAB - Practicar ahora */}
      <div className="add-quiz-btn-mobile" style={{
        position: "fixed", bottom: 72, left: 16, right: 16,
        zIndex: 40, display: "flex",
      }}>
        <button
          onClick={handleStartDrill}
          style={{
            width: "100%", padding: "14px 20px", borderRadius: 16,
            background: C.accent, color: "white", border: "none",
            fontSize: 15, fontWeight: 800, cursor: "pointer",
            fontFamily: "'Nunito', sans-serif",
            boxShadow: "0 4px 20px rgba(0,180,160,0.35)",
          }}
        >
          Practicar ahora
        </button>
      </div>



      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 1024px) {
          .pack-detail-grid { grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
        }
      `}</style>
    </div>
  );
}

// ── Exercise row ──
function ExerciseRow({ exercise, index }) {
  const meta = getExerciseMeta(exercise.type);
  const preview = getExercisePreview(exercise);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px", borderRadius: 14,
      background: C.card, border: `1px solid ${C.border}`,
      transition: "box-shadow 0.15s",
      overflow: "hidden", minWidth: 0,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      <ExerciseTypeIcon type={exercise.type} size={40} />

      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <p style={{
          fontSize: 13, fontWeight: 700, color: meta.color, margin: 0,
          fontFamily: "'Nunito', sans-serif",
        }}>
          {meta.label}
        </p>
        <p style={{
          fontSize: 13, fontWeight: 600, color: C.muted, margin: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          maxWidth: "100%",
        }}>
          {preview}
        </p>
      </div>

      <span style={{
        fontSize: 14, fontWeight: 700, color: "#D1D5DB",
        fontFamily: "'Nunito', sans-serif", flexShrink: 0,
        minWidth: 20, textAlign: "right",
      }}>
        {index}
      </span>
    </div>
  );
}
