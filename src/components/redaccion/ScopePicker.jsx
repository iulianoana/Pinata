import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { fetchLessons } from "../../lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "../ui/sheet";

function ScopeRadioCard({ selected, onClick, title, badge, description, chips, disabled }) {
  const borderClass = selected
    ? "border-[#F59E0B] bg-[#FFFBEB]"
    : "border-border bg-white hover:border-muted";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${borderClass} ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div className="flex items-start gap-3">
        {/* Radio dot */}
        <span className={`shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 ${selected ? "border-[#F59E0B]" : "border-border"} flex items-center justify-center`}>
          {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-extrabold text-text">{title}</span>
            {badge && (
              <span className="px-1.5 py-0.5 rounded-[4px] bg-[#F59E0B] text-white text-[10px] font-extrabold uppercase tracking-wider">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-muted leading-relaxed">
            {description}
          </p>
          {chips && chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {chips.map((chip, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-md bg-white border border-[#F59E0B] text-[#B45309] text-[11px] font-bold"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function ScopeBody({ siblings, currentLesson, scope, setScope, onSubmit, onCancel, submitting, layout }) {
  const unitAvailable = siblings.length > 1;
  const unitChips = siblings.map((l, i) => layout === "mobile" ? `L${i + 1}` : `Lección ${i + 1}`);
  const unitDescription = `Basado en las ${siblings.length} lecciones de esta unidad.`;
  const singleDescription = currentLesson
    ? `Basado en el contenido de ${currentLesson.title}.`
    : "Basado solo en esta lección.";

  return (
    <>
      <div className="flex flex-col gap-3 mt-2">
        {unitAvailable && (
          <ScopeRadioCard
            selected={scope === "unit"}
            onClick={() => setScope("unit")}
            title="Unidad completa"
            badge="Recomendado"
            description={unitDescription}
            chips={unitChips}
          />
        )}
        <ScopeRadioCard
          selected={scope === "single_lesson"}
          onClick={() => setScope("single_lesson")}
          title="Solo esta lección"
          description={singleDescription}
        />
      </div>

      {layout === "desktop" ? (
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-5 h-11 rounded-xl font-bold text-sm text-muted hover:text-text transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSubmit(scope)}
            disabled={submitting}
            className="px-5 h-11 rounded-xl font-extrabold text-sm bg-accent text-white flex items-center gap-2 hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            <Play size={14} fill="white" strokeWidth={0} />
            {submitting ? "Generando..." : "Generar"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-5">
          <button
            type="button"
            onClick={() => onSubmit(scope)}
            disabled={submitting}
            className="w-full h-12 rounded-xl font-extrabold text-sm bg-accent text-white flex items-center justify-center gap-2 hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            <Play size={14} fill="white" strokeWidth={0} />
            {submitting ? "Generando..." : "Generar"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="w-full h-11 rounded-xl font-bold text-sm text-muted hover:text-text transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      )}
    </>
  );
}

export default function ScopePicker({ open, onOpenChange, lessonId, weekId, onSubmit, submitting }) {
  const [siblings, setSiblings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState("unit");

  useEffect(() => {
    if (!open || !weekId) return;
    let cancelled = false;
    setLoading(true);
    fetchLessons(weekId)
      .then((lessons) => {
        if (cancelled) return;
        const sorted = [...lessons].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        setSiblings(sorted);
        setScope(sorted.length > 1 ? "unit" : "single_lesson");
      })
      .catch(() => {
        if (cancelled) return;
        setSiblings([]);
        setScope("single_lesson");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, weekId]);

  const currentLesson = siblings.find((l) => l.id === lessonId);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

  const handleCancel = () => onOpenChange(false);
  const handleSubmit = (s) => onSubmit(s);

  const content = loading ? (
    <div className="flex flex-col gap-3 mt-2">
      <div className="skeleton" style={{ height: 92, borderRadius: 12 }} />
      <div className="skeleton" style={{ height: 68, borderRadius: 12 }} />
    </div>
  ) : (
    <ScopeBody
      siblings={siblings}
      currentLesson={currentLesson}
      scope={scope}
      setScope={setScope}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      submitting={submitting}
      layout={isMobile ? "mobile" : "desktop"}
    />
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
        <SheetContent side="bottom" showClose={false} className="max-h-[85vh] overflow-y-auto">
          <SheetHeader className="px-5 pt-1">
            <SheetTitle>Nueva redacción</SheetTitle>
            <SheetDescription>Elige el alcance del contenido.</SheetDescription>
          </SheetHeader>
          <div className="px-5 pb-5">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Nueva redacción</DialogTitle>
          <DialogDescription>Elige el alcance del contenido.</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
