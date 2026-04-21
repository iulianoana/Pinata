import { useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, RefreshCw, Check, Pencil, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../ui/dialog";
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from "../ui/tooltip";
import BriefView from "./BriefView";
import EssayEditor from "./EssayEditor";
import WordCount from "./WordCount";
import SaveIndicator from "./SaveIndicator";
import CorrectionReview from "./CorrectionReview";
import CorrectingOverlay from "./CorrectingOverlay";
import { useEssayAutosave } from "../../lib/redaccion/use-essay-autosave";
import { countWords } from "../../lib/redaccion/word-count";

export default function AssignmentEditorDesktop({
  assignment,
  attempt,
  correction,
  view,
  correcting,
  correctionError,
  onBack,
  onDelete,
  onRegenerate,
  regenerating,
  onCorrect,
  onRetryCorrect,
}) {
  const brief = assignment.brief || {};
  const min = brief.extensionMin ?? 0;
  const max = brief.extensionMax ?? 0;
  const correctThreshold = Math.max(1, Math.round(min * 0.7));

  const [essay, setEssay] = useState(attempt.essay || "");
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);

  // Autosave idles in non-editor views — value won't change (textarea readOnly),
  // and the hook short-circuits when value === lastSavedValue. Still mounted so
  // it reattaches cleanly if the user ever goes back to editor mode.
  const { status, flushNow, retry } = useEssayAutosave({
    attemptId: attempt.id,
    value: essay,
    initialValue: attempt.essay || "",
  });

  const wordCount = countWords(essay);
  const canCorrect = view === "editor" && wordCount >= correctThreshold && !correcting;

  const handleRegenClick = () => {
    if (essay.trim().length > 0) {
      setConfirmRegenOpen(true);
    } else {
      onRegenerate();
    }
  };

  const confirmRegen = () => {
    setConfirmRegenOpen(false);
    onRegenerate();
  };

  return (
    <div className="fixed inset-0 lg:left-[220px] flex flex-col bg-white font-nunito" style={{ zIndex: 30 }}>
      {/* Top bar */}
      <div className="h-14 border-b border-[#E5E7EB] flex items-center px-5 gap-3 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="w-8 h-8 rounded-lg border border-[#E5E7EB] grid place-items-center text-[#4B5563] hover:bg-[#F9FAFB] transition-colors"
          aria-label="Volver a la lección"
        >
          <ChevronLeft size={14} strokeWidth={2.4} />
        </button>
        <ChevronRight size={12} color="#9CA3AF" strokeWidth={2.4} />
        <div className="flex items-center gap-1.5 min-w-0">
          <Pencil size={14} color="#D97706" strokeWidth={2.4} />
          <div className="font-black text-[#0F1720] text-sm truncate">
            {assignment.title}
          </div>
        </div>
        <div className="flex-1" />
        {view !== "review" && (
          <button
            type="button"
            onClick={onDelete}
            className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[#4B5563] text-sm font-bold hover:bg-[#F9FAFB] flex items-center gap-1.5 transition-colors"
          >
            <Trash2 size={14} strokeWidth={2.2} />
            Eliminar
          </button>
        )}
      </div>

      {/* 40 / 60 split */}
      <div className="flex-1 grid min-h-0" style={{ gridTemplateColumns: "2fr 3fr" }}>
        {/* Brief — left 40% */}
        <div className="border-r border-[#E5E7EB] bg-[#FAFAF7] flex flex-col min-h-0">
          <div className="overflow-auto px-7 py-6 flex-1">
            <BriefView brief={brief} />
            {view === "editor" && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={handleRegenClick}
                  disabled={regenerating}
                  className="text-[#6B7280] hover:text-[#0F1720] text-sm font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={13} strokeWidth={2.4} className={regenerating ? "animate-spin" : ""} />
                  {regenerating ? "Generando…" : "Regenerar tema"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right column — editor or review */}
        <div className="flex flex-col min-h-0 bg-white">
          {view === "review" ? (
            <CorrectionReview correction={correction} onBack={onBack} variant="desktop" />
          ) : (
            <>
              <div
                className={`flex-1 min-h-0 px-8 pt-6 pb-3 ${
                  view === "correcting" ? "overflow-visible" : "overflow-auto"
                }`}
              >
                {view === "correcting" ? (
                  <CorrectingOverlay error={correctionError} onRetry={onRetryCorrect}>
                    <EssayEditor
                      value={essay}
                      onChange={setEssay}
                      onBlur={flushNow}
                      autoFocus={false}
                      readOnly
                    />
                  </CorrectingOverlay>
                ) : (
                  <EssayEditor
                    value={essay}
                    onChange={setEssay}
                    onBlur={flushNow}
                    autoFocus={view === "editor"}
                    readOnly={view !== "editor"}
                  />
                )}
              </div>

              {/* Sticky footer */}
              <div className="border-t border-[#E5E7EB] px-8 py-3 flex items-center gap-4 bg-white shrink-0">
                <WordCount value={wordCount} min={min} max={max} />
                {view === "editor" && <SaveIndicator status={status} onRetry={retry} />}
                <div className="flex-1" />
                <CorregirButton
                  view={view}
                  canCorrect={canCorrect}
                  threshold={correctThreshold}
                  correcting={correcting}
                  onClick={onCorrect}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Regenerate confirm */}
      <Dialog open={confirmRegenOpen} onOpenChange={setConfirmRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Regenerar el tema?</DialogTitle>
            <DialogDescription>
              Vas a perder tu redacción actual. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmRegenOpen(false)}
              className="px-5 h-11 rounded-xl font-bold text-sm text-muted hover:text-text transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmRegen}
              className="px-5 h-11 rounded-xl font-extrabold text-sm bg-error text-white hover:opacity-90 transition-opacity"
            >
              Sí, regenerar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CorregirButton({ view, canCorrect, threshold, correcting, onClick }) {
  if (view === "correcting" || correcting) {
    return (
      <button
        type="button"
        disabled
        className="h-10 px-5 rounded-lg font-black text-sm flex items-center gap-2 bg-[#D1FAE5] text-[#047857] cursor-not-allowed"
      >
        <Sparkles size={14} strokeWidth={2.6} />
        Corrigiendo…
      </button>
    );
  }

  const button = (
    <button
      type="button"
      onClick={canCorrect ? onClick : undefined}
      disabled={!canCorrect}
      className={`h-10 px-5 rounded-lg font-black text-sm flex items-center gap-2 shadow-sm transition-colors ${
        !canCorrect
          ? "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
          : "bg-[#10B981] hover:bg-[#059669] text-white shadow-[#10B981]/30"
      }`}
    >
      <Check size={14} strokeWidth={2.6} />
      Corregir
    </button>
  );

  if (canCorrect) return button;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* span wrapper so Tooltip works with a disabled button */}
          <span tabIndex={0}>{button}</span>
        </TooltipTrigger>
        <TooltipContent>
          Escribe al menos {threshold} palabras
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
