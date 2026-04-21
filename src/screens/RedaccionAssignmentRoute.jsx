import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { C } from "../styles/theme";
import { fetchAssignment, deleteAssignment } from "../lib/api";

export default function RedaccionAssignmentRoute() {
  const { lessonId, assignmentId } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

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
          <p style={{ fontSize: 14, fontWeight: 600, color: C.muted, marginBottom: 28 }}>
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

          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "transparent", border: `1.5px solid ${C.error}`,
              color: C.error, fontSize: 14, fontWeight: 700,
              padding: "10px 18px", borderRadius: 10, cursor: deleting ? "default" : "pointer",
              fontFamily: "'Nunito', sans-serif", opacity: deleting ? 0.5 : 1,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { if (!deleting) e.currentTarget.style.background = C.errorLight; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <Trash2 size={14} strokeWidth={2.5} />
            {deleting ? "Eliminando..." : "Eliminar redacción"}
          </button>
        </>
      )}
    </div>
  );
}
