import { useNavigate, useLocation } from "react-router-dom";
import { C } from "../styles/theme";
import { SPANISH_TENSES, calculateGrade } from "../lib/conjugar/constants";
import { GradeCircle, ScoreBadge } from "../components/conjugar/shared";


/**
 * Conjugar drill results screen.
 *
 * Receives data via location.state:
 * {
 *   score: number,       // correct answers
 *   total: number,       // total questions
 *   percentage: number,  // computed percentage
 *   packIds: string[],   // pack IDs used in drill
 *   details: [{ verb_id, verb, tense, correct, total }],
 * }
 *
 * Session 3 will pass these after completing a drill.
 */
export default function ConjugarResultsScreen({ session }) {
  const navigate = useNavigate();
  const location = useLocation();
  const results = location.state || {};

  const {
    score = 0,
    total = 15,
    percentage = 0,
    details = [],
    packIds = [],
  } = results;

  const grade = calculateGrade(percentage);

  const GRADE_COLORS = {
    "A+": "#059669", A: "#059669", B: "#00B4A0", C: "#D97706", D: "#EA580C", F: "#DC2626",
  };
  const gradeColor = GRADE_COLORS[grade] || C.accent;

  const getTenseLabel = (tenseId) => {
    return SPANISH_TENSES.find((t) => t.id === tenseId)?.label || tenseId;
  };

  const handleBack = () => navigate("/conjugar");
  const handleRepeat = () => {
    if (packIds.length > 0) {
      navigate(`/conjugar/drill?packs=${packIds.join(",")}`);
    } else {
      navigate("/conjugar");
    }
  };

  return (
    <div className="fade-in" style={{ minHeight: "100vh", background: C.bg }}>
      <div className="desktop-main lessons-page safe-top" style={{
        paddingTop: 24, display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        {/* Grade circle */}
        <div style={{ marginBottom: 8 }}>
          <GradeCircle percentage={percentage} />
        </div>

        {/* Score text */}
        <p style={{ fontSize: 15, fontWeight: 600, color: C.muted, margin: "4px 0 28px" }}>
          {score}/{total} respuestas correctas
        </p>

        {/* Percentage card */}
        <div style={{
          width: "100%", maxWidth: 440, padding: "16px 20px",
          borderRadius: 16, border: `1.5px solid ${C.border}`,
          background: C.card, marginBottom: 16,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 10,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "'Nunito', sans-serif" }}>
              Puntuación
            </span>
            <span style={{ fontSize: 24, fontWeight: 900, color: gradeColor, fontFamily: "'Nunito', sans-serif" }}>
              {percentage}%
            </span>
          </div>
          <div style={{
            width: "100%", height: 8, borderRadius: 4,
            background: "#E5E7EB", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 4, background: gradeColor,
              width: `${percentage}%`, transition: "width 0.6s ease",
            }} />
          </div>
        </div>

        {/* Per-verb breakdown */}
        {details.length > 0 && (
          <div style={{
            width: "100%", maxWidth: 440, padding: "16px 20px",
            borderRadius: 16, border: `1.5px solid ${C.border}`,
            background: C.card, marginBottom: 24,
          }}>
            <h3 style={{
              fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 12px",
              fontFamily: "'Nunito', sans-serif",
            }}>
              Resumen por verbo
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {details.map((d, i) => {
                const pct = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 0",
                    borderTop: i > 0 ? `1px solid ${C.border}` : "none",
                  }}>
                    <span style={{
                      fontSize: 15, fontWeight: 800, color: C.text,
                      fontFamily: "'Nunito', sans-serif", minWidth: 80,
                    }}>
                      {d.verb || "—"}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.muted, flex: 1 }}>
                      {getTenseLabel(d.tense)}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginRight: 8 }}>
                      {d.correct}/{d.total}
                    </span>
                    <ScoreBadge percentage={pct} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{
          display: "flex", gap: 12, width: "100%", maxWidth: 440,
          marginBottom: 40,
        }}>
          <button
            onClick={handleBack}
            style={{
              flex: 1, padding: "14px 20px", borderRadius: 14,
              border: `2px solid ${C.border}`, background: "transparent",
              color: C.text, fontSize: 15, fontWeight: 800,
              cursor: "pointer", fontFamily: "'Nunito', sans-serif",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.accentLight; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Volver
          </button>
          <button
            onClick={handleRepeat}
            style={{
              flex: 1, padding: "14px 20px", borderRadius: 14,
              border: "none", background: C.accent, color: "white",
              fontSize: 15, fontWeight: 800,
              cursor: "pointer", fontFamily: "'Nunito', sans-serif",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.accentHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.accent; }}
          >
            Repetir drill
          </button>
        </div>
      </div>


    </div>
  );
}
