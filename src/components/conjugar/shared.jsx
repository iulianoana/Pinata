import { C } from "../../styles/theme";
import { calculateGrade } from "../../lib/conjugar/constants";

// ── Verb type badge colors ──
const TYPE_COLORS = {
  ar: { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  er: { bg: "#DBEAFE", text: "#1E40AF", border: "#BFDBFE" },
  ir: { bg: "#EDE9FE", text: "#6D28D9", border: "#DDD6FE" },
};

export function VerbTypeBadge({ type }) {
  const colors = TYPE_COLORS[type] || TYPE_COLORS.ar;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: colors.bg, color: colors.text,
      fontFamily: "'Nunito', sans-serif",
    }}>
      -{type}
    </span>
  );
}

// ── Score badge ──
export function ScoreBadge({ percentage, isNew }) {
  if (isNew || percentage == null) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center",
        padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
        background: "#F3F4F6", color: "#6B7280", border: "1px solid #E5E7EB",
        fontFamily: "'Nunito', sans-serif",
      }}>
        Nuevo
      </span>
    );
  }

  const color = percentage >= 80 ? "#059669" : percentage >= 60 ? "#D97706" : "#DC2626";
  const bg = percentage >= 80 ? "#ECFDF5" : percentage >= 60 ? "#FFFBEB" : "#FEF2F2";

  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: bg, color, border: `1px solid ${color}20`,
      fontFamily: "'Nunito', sans-serif",
    }}>
      {percentage}%
    </span>
  );
}

// ── Grade circle for results ──
const GRADE_COLORS = {
  "A+": "#059669", A: "#059669", B: "#00B4A0", C: "#D97706", D: "#EA580C", F: "#DC2626",
};
const GRADE_BG = {
  "A+": "#ECFDF5", A: "#ECFDF5", B: "#E0F5F1", C: "#FFFBEB", D: "#FFF7ED", F: "#FEF2F2",
};
const GRADE_LABELS = {
  "A+": "¡Excelente!", A: "¡Muy bien!", B: "¡Buen trabajo!",
  C: "Sigue practicando", D: "Necesitas repasar", F: "A estudiar más",
};

export function GradeCircle({ percentage }) {
  const grade = calculateGrade(percentage);
  const color = GRADE_COLORS[grade];
  const bg = GRADE_BG[grade];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 100, height: 100, borderRadius: "50%", background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 40, fontWeight: 900, color, fontFamily: "'Nunito', sans-serif" }}>
          {grade}
        </span>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: "'Nunito', sans-serif" }}>
        {GRADE_LABELS[grade]}
      </h2>
    </div>
  );
}

// ── Exercise type metadata ──
const EXERCISE_META = {
  classic_table: { label: "Tabla clásica", color: "#059669", icon: "\ud83d\udccb", bg: "#ECFDF5" },
  gap_fill: { label: "Completa la frase", color: "#EA580C", icon: "\u270f\ufe0f", bg: "#FFF7ED" },
  spot_error: { label: "Encuentra el error", color: "#DC2626", icon: "\ud83d\udd0d", bg: "#FEF2F2" },
  multiple_choice: { label: "Opción múltiple", color: "#D97706", icon: "\ud83c\udfaf", bg: "#FFFBEB" },
  chat_bubble: { label: "Conversación", color: "#7C3AED", icon: "\ud83d\udcac", bg: "#F5F3FF" },
  odd_one_out: { label: "El intruso", color: "#2563EB", icon: "\ud83e\udde9", bg: "#EFF6FF" },
  mini_story: { label: "Mini historia", color: "#0891B2", icon: "\ud83d\udcd6", bg: "#ECFEFF" },
  conjugation_chain: { label: "Cadena rápida", color: "#CA8A04", icon: "\u26a1", bg: "#FEFCE8" },
};

export function getExerciseMeta(type) {
  return EXERCISE_META[type] || EXERCISE_META.classic_table;
}

export function ExerciseTypeIcon({ type, size = 36 }) {
  const meta = getExerciseMeta(type);
  return (
    <div style={{
      width: size, height: size, borderRadius: 10,
      background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.5, flexShrink: 0,
    }}>
      {meta.icon}
    </div>
  );
}

// ── Exercise preview text helper ──
export function getExercisePreview(exercise) {
  switch (exercise.type) {
    case "classic_table":
      return `Completa: ${exercise.verb} (${exercise.tenseLabel || exercise.tense})`;
    case "gap_fill":
      return exercise.sentence;
    case "spot_error":
      return `"${exercise.words.join(" ")}"`;
    case "multiple_choice":
      return exercise.sentence;
    case "chat_bubble":
      return `Chat: ${exercise.messages?.[0]?.text?.substring(0, 40) || ""}...`;
    case "odd_one_out":
      return exercise.options.join(" / ");
    case "mini_story":
      return exercise.segments?.map((s) => s.isBlank ? "___" : s.text).join("") || "";
    case "conjugation_chain":
      return `\u26a1 ${exercise.chain?.map((c) => c.person).join(" \u2192 ")}...`;
    default:
      return "";
  }
}

// ── Time ago helper ──
export function timeAgo(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem.`;
  return `Hace ${Math.floor(diffDays / 30)} mes${Math.floor(diffDays / 30) > 1 ? "es" : ""}`;
}

export { GRADE_COLORS, GRADE_BG, GRADE_LABELS, TYPE_COLORS };
