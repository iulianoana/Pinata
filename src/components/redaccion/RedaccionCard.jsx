import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Feather, Plus } from "lucide-react";
import { fetchAssignmentsByLesson, createAssignment } from "../../lib/api";
import AssignmentMiniCard from "./AssignmentMiniCard";
import ScopePicker from "./ScopePicker";

export default function RedaccionCard({ lessonId, weekId }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAssignmentsByLesson(lessonId)
      .then((data) => { if (!cancelled) setAssignments(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lessonId]);

  const count = assignments.length;

  const handleGenerate = async (scope) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const created = await createAssignment({ lessonId, scope });
      setPickerOpen(false);
      navigate(`/lesson/${lessonId}/redaccion/${created.id}`);
    } catch (e) {
      console.error("Failed to create assignment:", e);
      setSubmitting(false);
    }
  };

  const goToAssignment = (id) => {
    navigate(`/lesson/${lessonId}/redaccion/${id}`);
  };

  return (
    <>
      <div className="rounded-2xl border border-border bg-white p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#B45309] flex items-center justify-center shrink-0">
              <Feather size={16} strokeWidth={2} />
            </span>
            <span className="text-[15px] font-extrabold text-text">Redacción</span>
          </div>
          {!loading && count > 0 && (
            <span className="text-xs font-semibold text-muted">
              <span className="hidden lg:inline">
                {count} asignaci{count === 1 ? "ón" : "ones"}
              </span>
              <span className="inline lg:hidden">
                {count} asig.
              </span>
            </span>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="skeleton" style={{ height: 52, borderRadius: 12 }} />
        )}

        {/* Empty state */}
        {!loading && count === 0 && (
          <div className="text-center py-3">
            <div className="w-12 h-12 rounded-xl bg-[#FFFBEB] mx-auto mb-3 flex items-center justify-center">
              <Feather size={20} strokeWidth={2} className="text-[#B45309] opacity-60" />
            </div>
            <p className="text-sm text-muted font-semibold leading-relaxed mb-3">
              Practica tu escritura con una tarea basada en esta lección.
            </p>
          </div>
        )}

        {/* Populated list */}
        {!loading && count > 0 && (
          <div className="flex flex-col gap-2 mb-2">
            {assignments.map((a) => (
              <AssignmentMiniCard
                key={a.id}
                assignment={a}
                onClick={() => goToAssignment(a.id)}
              />
            ))}
          </div>
        )}

        {/* Generate CTA */}
        {!loading && (
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full h-11 mt-2 rounded-xl border-2 border-dashed border-[#F59E0B] text-[#B45309] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#FFFBEB] transition-colors"
          >
            <Plus size={16} strokeWidth={2.5} />
            Generar redacción
          </button>
        )}
      </div>

      <ScopePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        lessonId={lessonId}
        weekId={weekId}
        onSubmit={handleGenerate}
        submitting={submitting}
      />
    </>
  );
}
