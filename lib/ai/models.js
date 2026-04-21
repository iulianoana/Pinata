export const MODEL_OPTIONS = [
  { id: "claude-opus-4-6", displayName: "Claude Opus 4.6", provider: "anthropic", tier: "Flagship" },
  { id: "gpt-5.4", displayName: "GPT-5.4", provider: "openai", tier: "Flagship" },
  { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", provider: "anthropic", tier: "Mid-tier" },
  { id: "gpt-5.4-mini", displayName: "GPT-5.4 Mini", provider: "openai", tier: "Mid-tier" },
];

export const DEFAULT_MODEL = MODEL_OPTIONS.find((m) => m.id === "gpt-5.4");

export function getModelById(id) {
  return MODEL_OPTIONS.find((m) => m.id === id) || DEFAULT_MODEL;
}

export const FEATURES = [
  { id: "carolina_chat", label: "Carolina Text Chat", description: "AI model for written conversations with Carolina" },
  { id: "vocabulary", label: "Vocabulary Explanations", description: "AI model for word explanations and corrections" },
  { id: "pdf_processing", label: "PDF Lesson Processing", description: "AI model for generating summaries and quizzes" },
  { id: "conjugar", label: "Conjugar Exercises", description: "AI model for generating conjugation drill exercises" },
  { id: "redaccion_generation", label: "Redacción Generation", description: "AI model for generating Spanish writing prompts" },
];
