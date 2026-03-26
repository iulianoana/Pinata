export const SPANISH_TENSES = [
  { id: "presente", label: "Presente" },
  { id: "preterito_indefinido", label: "Pretérito indefinido" },
  { id: "preterito_imperfecto", label: "Pretérito imperfecto" },
  { id: "preterito_perfecto", label: "Pretérito perfecto" },
  { id: "preterito_pluscuamperfecto", label: "Pretérito pluscuamperfecto" },
  { id: "futuro_simple", label: "Futuro simple" },
  { id: "futuro_perfecto", label: "Futuro perfecto" },
  { id: "condicional_simple", label: "Condicional simple" },
  { id: "condicional_compuesto", label: "Condicional compuesto" },
  { id: "subjuntivo_presente", label: "Subjuntivo presente" },
  { id: "subjuntivo_imperfecto", label: "Subjuntivo imperfecto" },
  { id: "imperativo", label: "Imperativo" },
];

export const TENSE_IDS = SPANISH_TENSES.map((t) => t.id);

export const EXERCISE_TYPES = [
  "classic_table",
  "gap_fill",
  "spot_error",
  "multiple_choice",
  "chat_bubble",
  "odd_one_out",
  "mini_story",
];

export const PERSONS = [
  "yo",
  "tú",
  "él/ella/usted",
  "nosotros",
  "vosotros",
  "ellos/ellas",
];

export function calculateGrade(percentage) {
  if (percentage >= 95) return "A+";
  if (percentage >= 90) return "A";
  if (percentage >= 80) return "B";
  if (percentage >= 70) return "C";
  if (percentage >= 60) return "D";
  return "F";
}

export function detectVerbType(infinitive) {
  const lower = infinitive.toLowerCase().trim();
  if (lower.endsWith("ar")) return "ar";
  if (lower.endsWith("er")) return "er";
  if (lower.endsWith("ir")) return "ir";
  return null;
}
