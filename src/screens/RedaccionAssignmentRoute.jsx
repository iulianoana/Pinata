import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, RefreshCw, AlertCircle } from "lucide-react";
import { C } from "../styles/theme";
import { fetchAssignment, deleteAssignment, regenerateAssignment } from "../lib/api";

function RegenerationSkeleton() {
  return (
    <div style={{
      borderRadius: 14, border: `1px solid ${C.border}`, padding: 20,
      marginBottom: 24, background: "#FFFEF9",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div
          style={{
            width: 12, height: 12, borderRadius: "50%",
            border: "2px solid #F59E0B", borderTopColor: "transparent",
            animation: "spin 0.9s linear infinite",
          }}
        />
        <span style={{
          color: "#B45309", fontWeight: 900, fontSize: 11,
          letterSpacing: "0.1em", textTransform: "uppercase",
        }}>
          Generando tema…
        </span>
      </div>
      <div style={{ height: 22, borderRadius: 6, background: "#F1F0EC", width: "75%", marginBottom: 12 }} />
      <div style={{ height: 10, borderRadius: 4, background: "#F1F0EC", width: "100%", marginBottom: 8 }} />
      <div style={{ height: 10, borderRadius: 4, background: "#F1F0EC", width: "83%", marginBottom: 8 }} />
      <div style={{ height: 10, borderRadius: 4, background: "#F1F0EC", width: "67%" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function RegenerationError({ onRetry }) {
  return (
    <div style={{
      padding: 12, borderRadius: 10, background: "#FEF2F2",
      display: "flex", alignItems: "center", gap: 8, marginBottom: 24,
    }}>
      <AlertCircle size={16} color="#991B1B" strokeWidth={2.5} />
      <span style={{ color: "#991B1B", fontSize: 14, fontWeight: 700 }}>
        No pudimos generar el tema
      </span>
      <button
        onClick={onRetry}
        style={{
          marginLeft: "auto", background: "none", border: "none",
          color: "#0D9488", fontSize: 14, fontWeight: 900, cursor: "pointer",
        }}
      >
        Reintentar
      </button>
    </div>
  );
}

function BriefPreview({ brief }) {
  if (!brief || brief._mock) return null;
  return (
    <div style={{
      background: "#FAFAF7", borderRadius: 14, padding: 20,
      border: `1px solid ${C.border}`, marginBottom: 24,
      fontFamily: "'Nunito', sans-serif", color: C.text,
    }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 4 }}>
        {brief.nivel} · {brief.extensionMin}–{brief.extensionMax} palabras
      </p>

      <h3 style={{ fontSize: 13, fontWeight: 900, color: "#B45309", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 16, marginBottom: 6 }}>Misión</h3>
      <p style={{ fontSize: 15, lineHeight: 1.6 }}>{brief.mision}</p>

      <h3 style={{ fontSize: 13, fontWeight: 900, color: "#B45309", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 16, marginBottom: 6 }}>Requisitos</h3>
      <ul style={{ paddingLeft: 18, fontSize: 15, lineHeight: 1.6, margin: 0 }}>
        {brief.requisitos?.map((r, i) => <li key={i}>{r}</li>)}
      </ul>

      <h3 style={{ fontSize: 13, fontWeight: 900, color: "#B45309", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 16, marginBottom: 6 }}>Estructura sugerida</h3>
      <ol style={{ paddingLeft: 20, fontSize: 15, lineHeight: 1.6, margin: 0 }}>
        {brief.estructura?.map((s, i) => <li key={i}>{s}</li>)}
      </ol>

      <h3 style={{ fontSize: 13, fontWeight: 900, color: "#B45309", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 16, marginBottom: 6 }}>Preguntas de apoyo</h3>
      <ul style={{ paddingLeft: 18, fontSize: 15, fontStyle: "italic", lineHeight: 1.6, margin: 0 }}>
        {brief.preguntas?.map((q, i) => <li key={i}>{q}</li>)}
      </ul>

      <div style={{
        marginTop: 18, padding: 12, borderRadius: 10,
        background: "#FEF3C7", border: "1px solid #FDE68A",
        fontSize: 14, fontWeight: 600,
      }}>
        💡 {brief.consejo}
      </div>
    </div>
  );
}

export default function RedaccionAssignmentRoute() {
  const { lessonId, assignmentId } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAssignment(assignmentId)
      .then((data) => { if (!cancelled) setAssignment(data); })
      .catch((e) => { if (!cancelled) setError(e.message || "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [assignmentId]);

  const handleDelete = async () => {
    if (!window.confirm("¿Eliminar esta redacción? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    try {
      await deleteAssignment(assignmentId);
      navigate(`/lesson/${lessonId}`);
    } catch (e) {
      setError(e.message || "Failed to delete");
      setDeleting(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenError(false);
    setRegenerating(true);
    try {
      const updated = await regenerateAssignment(assignmentId);
      setAssignment(updated);
    } catch (e) {
      console.error(e);
      setRegenError(true);
    } finally {
      setRegenerating(false);
    }
  };

  const handleBack = () => navigate(`/lesson/${lessonId}`);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 96px" }}>
      <button
        onClick={handleBack}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer",
          color: C.muted, fontSize: 13, fontWeight: 700,
          fontFamily: "'Nunito', sans-serif", padding: "4px 0", marginBottom: 20,
        }}
      >
        <ArrowLeft size={16} strokeWidth={2.5} />
        Volver a la lección
      </button>

      {loading && (
        <div className="skeleton" style={{ height: 32, width: 320, borderRadius: 8, marginBottom: 16 }} />
      )}

      {error && !loading && (
        <p style={{ color: C.error, fontSize: 14, fontWeight: 600 }}>{error}</p>
      )}

      {assignment && (
        <>
          <h1 style={{
            fontSize: 28, fontWeight: 800, color: C.text, marginBottom: 8,
            fontFamily: "'Nunito', sans-serif",
          }}>
            {assignment.title}
          </h1>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.muted, marginBottom: 20 }}>
            La experiencia de redacción completa llegará en la próxima actualización.
          </p>

          <div style={{
            background: C.inputBg, borderRadius: 14, padding: 20,
            border: `1px solid ${C.border}`, marginBottom: 24,
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 8 }}>
              Alcance
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
              {assignment.scope === "unit" ? "Unidad completa" : "Solo esta lección"}
            </p>
          </div>

          {regenerating && <RegenerationSkeleton />}
          {regenError && !regenerating && <RegenerationError onRetry={handleRegenerate} />}
          {!regenerating && !regenError && <BriefPreview brief={assignment.brief} />}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={handleRegenerate}
              disabled={regenerating || deleting}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "transparent", border: `1.5px solid #F59E0B`,
                color: "#B45309", fontSize: 14, fontWeight: 700,
                padding: "10px 18px", borderRadius: 10,
                cursor: regenerating || deleting ? "default" : "pointer",
                fontFamily: "'Nunito', sans-serif",
                opacity: regenerating || deleting ? 0.5 : 1,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { if (!regenerating && !deleting) e.currentTarget.style.background = "#FEF3C7"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <RefreshCw size={14} strokeWidth={2.5} />
              {regenerating ? "Generando..." : "Regenerar tema"}
            </button>

            <button
              onClick={handleDelete}
              disabled={deleting || regenerating}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "transparent", border: `1.5px solid ${C.error}`,
                color: C.error, fontSize: 14, fontWeight: 700,
                padding: "10px 18px", borderRadius: 10,
                cursor: deleting || regenerating ? "default" : "pointer",
                fontFamily: "'Nunito', sans-serif",
                opacity: deleting || regenerating ? 0.5 : 1,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { if (!deleting && !regenerating) e.currentTarget.style.background = C.errorLight; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <Trash2 size={14} strokeWidth={2.5} />
              {deleting ? "Eliminando..." : "Eliminar redacción"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
