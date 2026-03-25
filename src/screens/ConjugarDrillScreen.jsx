import { useNavigate, useSearchParams } from "react-router-dom";
import { C } from "../styles/theme";
import MobileNavBar from "../components/MobileNavBar";

/**
 * Conjugar drill session screen — placeholder for Session 3.
 *
 * Receives pack IDs via query param: /conjugar/drill?packs=id1,id2,id3
 * Session 3 will implement the full drill engine with exercise rendering,
 * answer checking, progress tracking, and navigation to results.
 */
export default function ConjugarDrillScreen({ session }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const packIds = (searchParams.get("packs") || "").split(",").filter(Boolean);

  return (
    <div className="desktop-main">
      <div className="lessons-page fade-in safe-top" style={{
        paddingTop: 24, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", minHeight: "60vh",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
        <h2 style={{
          fontSize: 22, fontWeight: 800, color: C.text, margin: "0 0 8px",
          fontFamily: "'Nunito', sans-serif",
        }}>
          Drill — próximamente
        </h2>
        <p style={{
          fontSize: 14, fontWeight: 600, color: C.muted, marginBottom: 4,
          textAlign: "center", maxWidth: 360,
        }}>
          El motor de ejercicios se implementará en la Sesión 3.
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 24 }}>
          {packIds.length} paquete{packIds.length !== 1 ? "s" : ""} seleccionado{packIds.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => navigate("/conjugar")}
          style={{
            padding: "12px 28px", borderRadius: 14, border: "none",
            background: C.accent, color: "white", fontSize: 15, fontWeight: 800,
            cursor: "pointer", fontFamily: "'Nunito', sans-serif",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.accentHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = C.accent; }}
        >
          Volver a Conjugar
        </button>
      </div>
      <MobileNavBar active="conjugar" />
    </div>
  );
}
