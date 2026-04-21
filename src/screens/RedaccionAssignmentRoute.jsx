import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import {
  fetchAssignment,
  fetchOrCreateDraftAttempt,
  deleteAssignment,
  regenerateAssignment,
  correctAttempt,
} from "../lib/api";

const DESKTOP_BREAKPOINT = 1024;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= DESKTOP_BREAKPOINT
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isDesktop;
}

export default function RedaccionAssignmentRoute() {
  const { lessonId, assignmentId } = useParams();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const [assignment, setAssignment] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [correction, setCorrection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [correctionError, setCorrectionError] = useState("");

  // Guard against double-firing the auto-resume correction call in StrictMode.
  const resumeFiredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.all([
      fetchAssignment(assignmentId),
      fetchOrCreateDraftAttempt(assignmentId),
    ])
      .then(([asn, att]) => {
        if (cancelled) return;
        setAssignment(asn);
        // draft-attempt returns { ...attempt, correction: {...}|null }
        const { correction: embeddedCorrection, ...attemptOnly } = att || {};
        setAttempt(attemptOnly);
        setCorrection(embeddedCorrection || null);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "No se pudo cargar la redacción.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [assignmentId]);

  // Auto-resume: if the attempt is submitted but has no correction yet,
  // the LLM call either never finished or was cut off by reload. Re-fire
  // the idempotent /correct endpoint; the server returns the existing row
  // if one got inserted, or redoes the LLM call otherwise.
  useEffect(() => {
    if (!attempt || correction || correcting || correctionError) return;
    if (!attempt.submitted_at) return;
    if (resumeFiredRef.current) return;
    resumeFiredRef.current = true;
    runCorrection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, correction]);

  const handleBack = () => navigate(`/lesson/${lessonId}`);

  const handleDelete = async () => {
    if (!window.confirm("¿Eliminar esta redacción? Esta acción no se puede deshacer.")) return;
    try {
      await deleteAssignment(assignmentId);
      navigate(`/lesson/${lessonId}`);
    } catch (e) {
      setError(e.message || "No se pudo eliminar.");
    }
  };

  const handleRegenerate = async () => {
    setRegenError("");
    setRegenerating(true);
    try {
      const updated = await regenerateAssignment(assignmentId);
      setAssignment((prev) => ({ ...(prev || {}), ...updated }));
    } catch (e) {
      setRegenError(e.message || "No pudimos generar el tema.");
    } finally {
      setRegenerating(false);
    }
  };

  async function runCorrection() {
    if (!attempt) return;
    setCorrectionError("");
    setCorrecting(true);
    try {
      const { attempt: updatedAttempt, correction: newCorrection } =
        await correctAttempt(attempt.id);
      setAttempt((prev) => ({ ...(prev || {}), ...updatedAttempt }));
      setCorrection(newCorrection);
    } catch (e) {
      setCorrectionError(e.message || "No pudimos corregir la redacción.");
    } finally {
      setCorrecting(false);
    }
  }

  const handleCorrect = () => {
    resumeFiredRef.current = true;
    runCorrection();
  };

  const handleRetryCorrect = () => {
    runCorrection();
  };

  if (loading) return <FullPageLoading />;
  if (error) return <FullPageError message={error} onBack={handleBack} />;
  if (!assignment || !attempt) return <FullPageError message="Redacción no disponible." onBack={handleBack} />;

  // Fold the in-flight `correcting` flag into the view so the glow appears
  // the instant the user clicks, not only after the server responds with
  // submitted_at. Either the client-side flag OR the persisted column means
  // "correction in flight".
  const view =
    correction ? "review" :
    (attempt.submitted_at || correcting) ? "correcting" :
    "editor";

  const Shell = isDesktop ? DesktopLazy : MobileLazy;
  return (
    <>
      <Shell
        assignment={assignment}
        attempt={attempt}
        correction={correction}
        view={view}
        correcting={correcting || view === "correcting"}
        correctionError={correctionError}
        onBack={handleBack}
        onDelete={handleDelete}
        onRegenerate={handleRegenerate}
        regenerating={regenerating}
        onCorrect={handleCorrect}
        onRetryCorrect={handleRetryCorrect}
      />
      {regenError && (
        <RegenErrorToast message={regenError} onRetry={handleRegenerate} onDismiss={() => setRegenError("")} />
      )}
    </>
  );
}

// Lazy-imported on first render to keep both shells out of each other's bundle path.
import AssignmentEditorDesktop from "../components/redaccion/AssignmentEditorDesktop";
import AssignmentEditorMobile from "../components/redaccion/AssignmentEditorMobile";
function DesktopLazy(props) { return <AssignmentEditorDesktop {...props} />; }
function MobileLazy(props) { return <AssignmentEditorMobile {...props} />; }

function FullPageLoading() {
  return (
    <div className="fixed inset-0 lg:left-[220px] flex items-center justify-center bg-white font-nunito" style={{ zIndex: 30 }}>
      <div className="flex items-center gap-2 text-muted text-sm font-bold">
        <span className="w-3 h-3 rounded-full border-2 border-[#F59E0B] border-t-transparent animate-spin" />
        Cargando…
      </div>
    </div>
  );
}

function FullPageError({ message, onBack }) {
  return (
    <div className="fixed inset-0 lg:left-[220px] flex items-center justify-center bg-white font-nunito p-6" style={{ zIndex: 30 }}>
      <div className="max-w-sm text-center">
        <div className="inline-grid place-items-center w-12 h-12 rounded-xl bg-[#FEF2F2] mb-3">
          <AlertCircle size={22} color="#991B1B" strokeWidth={2.4} />
        </div>
        <p className="text-text font-bold text-sm mb-4">{message}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 h-11 rounded-xl font-extrabold text-sm bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          Volver a la lección
        </button>
      </div>
    </div>
  );
}

function RegenErrorToast({ message, onRetry, onDismiss }) {
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] shadow-lg flex items-center gap-3 font-nunito"
      style={{ zIndex: 60 }}
    >
      <AlertCircle size={16} color="#991B1B" strokeWidth={2.5} />
      <span className="text-[#991B1B] text-sm font-bold">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="text-[#059669] text-sm font-black hover:underline"
      >
        Reintentar
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="text-[#6B7280] text-sm font-bold hover:text-[#0F1720]"
      >
        ✕
      </button>
    </div>
  );
}
