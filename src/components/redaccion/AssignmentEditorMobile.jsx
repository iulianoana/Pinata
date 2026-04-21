import { useRef, useState } from "react";
import { ChevronLeft, Trash2, RefreshCw, Check, Pencil, Feather, Sparkles } from "lucide-react";
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

const SWIPE_THRESHOLD = 50;

export default function AssignmentEditorMobile({
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

  const [tab, setTab] = useState(view === "correcting" ? "escribir" : "tarea"); // "tarea" | "escribir"
  const [essay, setEssay] = useState(attempt.essay || "");
  const [cursorOffset, setCursorOffset] = useState(null);
  const [scrollTop, setScrollTop] = useState(null);
  const [briefScrollTop, setBriefScrollTop] = useState(0);
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);

  const briefRef = useRef(null);
  const touchStartX = useRef(null);

  const { status, flushNow, retry } = useEssayAutosave({
    attemptId: attempt.id,
    value: essay,
    initialValue: attempt.essay || "",
  });

  const wordCount = countWords(essay);
  const canCorrect = view === "editor" && wordCount >= correctThreshold && !correcting;

  const switchTo = (next) => {
    if (next === tab) return;
    if (tab === "tarea" && briefRef.current) {
      setBriefScrollTop(briefRef.current.scrollTop);
    }
    setTab(next);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (dx < 0 && tab === "tarea") switchTo("escribir");
    else if (dx > 0 && tab === "escribir") switchTo("tarea");
  };

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

  // Review mode owns the whole body.
  if (view === "review") {
    return (
      <div className="fixed inset-0 flex flex-col bg-white font-nunito" style={{ zIndex: 30 }}>
        <div className="h-12 px-4 flex items-center gap-2 border-b border-[#E5E7EB] bg-white shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 -ml-1.5 grid place-items-center text-[#10B981]"
            aria-label="Volver a la lección"
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </button>
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Pencil size={14} color="#D97706" strokeWidth={2.4} className="shrink-0" />
            <div className="font-black text-[#0F1720] text-sm truncate">{assignment.title}</div>
          </div>
        </div>
        <CorrectionReview correction={correction} onBack={onBack} variant="mobile" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white font-nunito" style={{ zIndex: 30 }}>
      {/* Top bar */}
      <div className="h-12 px-4 flex items-center gap-2 border-b border-[#E5E7EB] bg-white shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 -ml-1.5 grid place-items-center text-[#10B981]"
          aria-label="Volver a la lección"
        >
          <ChevronLeft size={22} strokeWidth={2.6} />
        </button>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Pencil size={14} color="#D97706" strokeWidth={2.4} className="shrink-0" />
          <div className="font-black text-[#0F1720] text-sm truncate">{assignment.title}</div>
        </div>
        {view !== "correcting" && (
          <button
            type="button"
            onClick={onDelete}
            className="w-9 h-9 grid place-items-center text-[#6B7280] hover:text-error"
            aria-label="Eliminar redacción"
          >
            <Trash2 size={18} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {/* Segmented control */}
      <div className="p-3 bg-white border-b border-[#E5E7EB] shrink-0">
        <div className="flex h-10 bg-[#F3F4F6] rounded-xl p-1">
          <SegBtn active={tab === "tarea"} onClick={() => switchTo("tarea")}>
            <Feather size={14} strokeWidth={2.4} />
            Tarea
          </SegBtn>
          <SegBtn active={tab === "escribir"} onClick={() => switchTo("escribir")}>
            <Pencil size={14} strokeWidth={2.4} />
            Escribir
          </SegBtn>
        </div>
      </div>

      {/* View body */}
      <div
        className="flex-1 min-h-0 flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {tab === "tarea" ? (
          <TareaView
            briefRef={briefRef}
            initialScrollTop={briefScrollTop}
            brief={brief}
            onRegenerate={handleRegenClick}
            regenerating={regenerating}
            allowRegenerate={view === "editor"}
          />
        ) : (
          <EscribirView
            view={view}
            essay={essay}
            setEssay={setEssay}
            cursorOffset={cursorOffset}
            setCursorOffset={setCursorOffset}
            scrollTop={scrollTop}
            setScrollTop={setScrollTop}
            onBlur={flushNow}
            wordCount={wordCount}
            min={min}
            max={max}
            status={status}
            onRetry={retry}
            canCorrect={canCorrect}
            correcting={correcting}
            correctionError={correctionError}
            correctThreshold={correctThreshold}
            onCorrect={onCorrect}
            onRetryCorrect={onRetryCorrect}
          />
        )}
      </div>

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

function SegBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors ${
        active
          ? "bg-white text-[#0F1720] font-black shadow-sm"
          : "text-[#6B7280] font-bold"
      }`}
    >
      {children}
    </button>
  );
}

function TareaView({ briefRef, initialScrollTop, brief, onRegenerate, regenerating, allowRegenerate }) {
  const setRef = (el) => {
    briefRef.current = el;
    if (el && initialScrollTop) el.scrollTop = initialScrollTop;
  };
  return (
    <div ref={setRef} className="flex-1 overflow-auto bg-[#FAFAF7] px-5 py-5">
      <BriefView brief={brief} density="compact" />
      {allowRegenerate && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="text-[#6B7280] hover:text-[#0F1720] text-sm font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={13} strokeWidth={2.4} className={regenerating ? "animate-spin" : ""} />
            {regenerating ? "Generando…" : "Regenerar tema"}
          </button>
        </div>
      )}
      <div className="pt-6 pb-2 flex justify-center">
        <div className="text-[#9CA3AF] text-[11px] font-bold">
          ← Desliza para escribir
        </div>
      </div>
    </div>
  );
}

function EscribirView({
  view, essay, setEssay, cursorOffset, setCursorOffset, scrollTop, setScrollTop,
  onBlur, wordCount, min, max, status, onRetry, canCorrect, correcting, correctionError,
  correctThreshold, onCorrect, onRetryCorrect,
}) {
  const isCorrecting = view === "correcting";

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      <div className={`flex-1 min-h-0 px-5 pt-3 pb-1 ${isCorrecting ? "overflow-visible" : "overflow-auto"}`}>
        {isCorrecting ? (
          <CorrectingOverlay error={correctionError} onRetry={onRetryCorrect} compact>
            <EssayEditor
              value={essay}
              onChange={setEssay}
              onCursorChange={setCursorOffset}
              onScrollChange={setScrollTop}
              onBlur={onBlur}
              cursorOffset={cursorOffset}
              scrollTop={scrollTop}
              autoFocus={false}
              readOnly
            />
          </CorrectingOverlay>
        ) : (
          <EssayEditor
            value={essay}
            onChange={setEssay}
            onCursorChange={setCursorOffset}
            onScrollChange={setScrollTop}
            onBlur={onBlur}
            cursorOffset={cursorOffset}
            scrollTop={scrollTop}
            autoFocus={view === "editor"}
            readOnly={view !== "editor"}
          />
        )}
      </div>

      <div className="px-4 py-3 border-t border-[#E5E7EB] flex items-center gap-3 bg-white shrink-0">
        <WordCount value={wordCount} min={min} max={max} size="sm" />
        {view === "editor" && <SaveIndicator status={status} onRetry={onRetry} size="sm" />}
        <div className="flex-1" />
        <CorregirButtonMobile
          view={view}
          canCorrect={canCorrect}
          threshold={correctThreshold}
          correcting={correcting}
          onClick={onCorrect}
        />
      </div>
    </div>
  );
}

function CorregirButtonMobile({ view, canCorrect, threshold, correcting, onClick }) {
  if (view === "correcting" || correcting) {
    return (
      <button
        type="button"
        disabled
        className="h-10 px-4 rounded-lg font-black text-sm shrink-0 flex items-center gap-1.5 bg-[#D1FAE5] text-[#047857] cursor-not-allowed"
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
      className={`h-10 px-4 rounded-lg font-black text-sm shrink-0 flex items-center gap-1.5 transition-colors ${
        !canCorrect
          ? "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
          : "bg-[#10B981] hover:bg-[#059669] text-white"
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
          <span tabIndex={0}>{button}</span>
        </TooltipTrigger>
        <TooltipContent>Escribe al menos {threshold} palabras</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
