import { Pencil, CheckCircle, ChevronRight } from "lucide-react";

const SPANISH_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatRelative(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "hoy";
  return `${d.getDate()} ${SPANISH_MONTHS[d.getMonth()]}`;
}

export default function AssignmentMiniCard({ assignment, onClick }) {
  const latest = assignment.latest_attempt;
  const corrected = latest && latest.status === "Corregida";

  const iconBgClass = corrected
    ? "bg-success-light text-success"
    : "bg-[#FEF3C7] text-[#B45309]";
  const Icon = corrected ? CheckCircle : Pencil;

  let metaLine;
  if (!latest) {
    metaLine = (
      <>
        Sin empezar · {formatRelative(assignment.created_at)} ·{" "}
        <span className="font-bold text-muted">Borrador</span>
      </>
    );
  } else {
    const dateBasis = latest.submitted_at || assignment.created_at;
    metaLine = (
      <>
        {latest.word_count} palabras · {formatRelative(dateBasis)} ·{" "}
        {corrected ? (
          <span className="font-bold text-success">Corregida</span>
        ) : (
          <span className="font-bold text-muted">Borrador</span>
        )}
      </>
    );
  }

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 py-3 px-3.5 rounded-xl border border-border bg-white cursor-pointer transition-all hover:bg-[#FFFBEB] hover:shadow-[0_2px_8px_rgba(180,83,9,0.08)]"
    >
      <div className={`w-9 h-9 rounded-[10px] shrink-0 flex items-center justify-center ${iconBgClass}`}>
        <Icon size={16} strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-text overflow-hidden text-ellipsis whitespace-nowrap">
          {assignment.title}
        </div>
        <div className="text-xs font-semibold text-muted mt-0.5">
          {metaLine}
        </div>
      </div>

      <ChevronRight size={14} strokeWidth={2.5} className="shrink-0 text-muted" />
    </div>
  );
}
