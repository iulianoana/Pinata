import { AlertCircle } from "lucide-react";

// Visual wrapper shown while the LLM is reviewing the essay.
//   - Pulsing teal glow (animate-correcting-glow) frames the card
//   - A thin vertical beam with a soft halo sweeps left ↔ right across the
//     essay — pure CSS, pauses smoothly at each edge via ease-in-out alternate
//   - Essay dims slightly so it reads as "locked / under review"
//   - A status pill anchored top-right flips to red + Reintentar on error
export default function CorrectingOverlay({
  children,
  error,
  onRetry,
  compact = false,
}) {
  return (
    <div className="relative h-full w-full">
      <div
        className="relative h-full rounded-2xl overflow-hidden animate-correcting-glow"
        style={{
          border: "1.5px solid rgba(16,185,129,0.55)",
          background:
            "linear-gradient(180deg, rgba(236,253,245,0.55) 0%, rgba(255,255,255,0.95) 45%, rgba(255,255,255,0.95) 55%, rgba(209,250,229,0.45) 100%)",
        }}
      >
        {/* Essay content — slightly dimmed */}
        <div className="relative h-full overflow-auto px-4 sm:px-6" style={{ opacity: 0.78 }}>
          {children}
        </div>

        {/* Sweeping beam layer — absolute, clipped by the overflow-hidden above. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute top-0 bottom-0 animate-scan-sweep"
            style={{
              width: "2px",
              marginLeft: "-1px",
              background:
                "linear-gradient(180deg, rgba(16,185,129,0) 0%, rgba(16,185,129,0.55) 12%, #10B981 45%, #059669 50%, #10B981 55%, rgba(16,185,129,0.55) 88%, rgba(16,185,129,0) 100%)",
              boxShadow:
                "0 0 48px 18px rgba(16,185,129,0.22), 0 0 20px 6px rgba(16,185,129,0.45), 0 0 8px 2px rgba(16,185,129,0.7)",
              willChange: "left",
            }}
          />
        </div>
      </div>

      {/* Status pill — always on top of everything */}
      <StatusPill error={error} onRetry={onRetry} compact={compact} />
    </div>
  );
}

function StatusPill({ error, onRetry, compact }) {
  const pos = compact ? "top-2 right-2" : "top-3 right-3";
  if (error) {
    return (
      <div
        className={`absolute ${pos} flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FEF2F2] border border-[#FCA5A5] shadow-md z-10`}
      >
        <AlertCircle size={12} color="#991B1B" strokeWidth={2.6} />
        <span className="text-[#991B1B] text-[11px] font-black tracking-widest uppercase">
          Error al corregir
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="text-[#991B1B] text-[11px] font-black hover:underline"
        >
          · Reintentar
        </button>
      </div>
    );
  }
  return (
    <div
      className={`absolute ${pos} flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#10B981] z-10`}
      style={{ boxShadow: "0 4px 14px rgba(16,185,129,0.35)" }}
    >
      <span className="relative flex w-2.5 h-2.5">
        <span className="absolute inset-0 rounded-full bg-[#10B981] animate-ping opacity-75" />
        <span className="relative w-2.5 h-2.5 rounded-full bg-[#10B981]" />
      </span>
      <span className="text-[#047857] text-[11px] font-black tracking-widest uppercase">
        {compact ? "Corrigiendo…" : "Corrigiendo tu redacción…"}
      </span>
    </div>
  );
}
