import { ChevronLeft } from "lucide-react";
import SegmentRenderer from "./SegmentRenderer";

// Review view for a corrected attempt. Renders summary, scores, the essay
// with inline segment corrections, and a back button. Variant controls the
// score layout: stacked bars on desktop, 3-column compact grid on mobile.
export default function CorrectionReview({ correction, onBack, variant = "desktop" }) {
  if (!correction) return null;

  const {
    summary,
    score_grammar: scoreGrammar,
    score_vocabulary: scoreVocabulary,
    score_structure: scoreStructure,
    segments,
  } = correction;

  return (
    <div className="flex flex-col min-h-0 bg-white h-full">
      {/* Scrollable body */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[760px] mx-auto px-6 py-6 sm:px-8 sm:py-8">
          <Legend />

          {summary && (
            <div className="mb-5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
              <div className="text-[#9CA3AF] text-[11px] font-black tracking-widest uppercase mb-1">
                Resumen
              </div>
              <p className="text-[#0F1720] text-sm font-bold leading-relaxed">
                {summary}
              </p>
            </div>
          )}

          {variant === "mobile" ? (
            <MobileScores
              scoreGrammar={scoreGrammar}
              scoreVocabulary={scoreVocabulary}
              scoreStructure={scoreStructure}
            />
          ) : (
            <DesktopScores
              scoreGrammar={scoreGrammar}
              scoreVocabulary={scoreVocabulary}
              scoreStructure={scoreStructure}
            />
          )}

          <div className="mt-6 mb-24 sm:mb-8">
            <div className="text-[#9CA3AF] text-[11px] font-black tracking-widest uppercase mb-3">
              Tu redacción · corregida
            </div>
            <SegmentRenderer segments={segments} />
          </div>
        </div>
      </div>

      {/* Bottom bar (sticky on mobile, inline on desktop). */}
      <div className={`border-t border-[#E5E7EB] bg-white px-6 py-3 sm:px-8 ${variant === "mobile" ? "sticky bottom-0" : ""}`}>
        <div className="max-w-[760px] mx-auto flex items-center">
          <button
            type="button"
            onClick={onBack}
            className="h-11 px-5 rounded-xl border border-[#E5E7EB] text-[#374151] font-bold text-sm hover:bg-[#F9FAFB] flex items-center gap-1.5 transition-colors"
          >
            <ChevronLeft size={14} strokeWidth={2.4} />
            Volver a la lección
          </button>
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 flex-wrap mb-5 pb-4 border-b border-[#F3F4F6]">
      <div className="text-[#9CA3AF] text-[11px] font-black tracking-widest uppercase">
        Leyenda
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="px-1 py-[1px] rounded text-xs"
          style={{
            color: "#991B1B",
            background: "#FEF2F2",
            textDecoration: "line-through",
            textDecorationColor: "#EF4444",
            textDecorationThickness: "2px",
          }}
        >
          son
        </span>
        <span className="text-[11px] font-bold text-[#6B7280]">tachado</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="px-[5px] py-[1px] rounded text-xs font-bold"
          style={{ color: "#065F46", background: "#D1FAE5" }}
        >
          es
        </span>
        <span className="text-[11px] font-bold text-[#6B7280]">corrección</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="px-1 py-[1px] rounded text-xs"
          style={{ color: "#92400E", background: "#FFFBEB", borderBottom: "2px dotted #F59E0B" }}
        >
          simpática
        </span>
        <span className="text-[11px] font-bold text-[#6B7280]">sugerencia</span>
      </div>
      <div className="flex-1" />
      <div className="text-[11px] font-bold text-[#9CA3AF]">
        Todo visible · listo para captura
      </div>
    </div>
  );
}

function DesktopScores({ scoreGrammar, scoreVocabulary, scoreStructure }) {
  return (
    <div className="space-y-3 mb-2">
      <ScoreBar label="Gramática" value={scoreGrammar} />
      <ScoreBar label="Vocabulario" value={scoreVocabulary} />
      <ScoreBar label="Estructura" value={scoreStructure} />
    </div>
  );
}

function ScoreBar({ label, value }) {
  const pct = Math.max(0, Math.min(10, value ?? 0)) * 10;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="font-bold text-sm text-[#1F2937]">{label}</div>
        <div className="font-black text-[#059669] tabular-nums text-sm">
          {value}
          <span className="text-[#9CA3AF] font-bold">/10</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
        <div className="h-full rounded-full bg-[#10B981]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MobileScores({ scoreGrammar, scoreVocabulary, scoreStructure }) {
  return (
    <div className="grid grid-cols-3 gap-2 mb-2">
      <CompactScore label="Gram." value={scoreGrammar} />
      <CompactScore label="Vocab." value={scoreVocabulary} />
      <CompactScore label="Estr." value={scoreStructure} />
    </div>
  );
}

function CompactScore({ label, value }) {
  const pct = Math.max(0, Math.min(10, value ?? 0)) * 10;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] font-bold text-[#6B7280]">{label}</div>
        <div className="text-[11px] font-black text-[#059669] tabular-nums">
          {value}/10
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[#F3F4F6]">
        <div className="h-full rounded-full bg-[#10B981]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
