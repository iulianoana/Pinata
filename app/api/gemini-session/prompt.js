import { loadPrompt } from "../../../lib/ai/prompts/load-prompt.js";

export async function buildSystemInstruction(unitContext, options = {}) {
  const base = await loadPrompt("carolina/carolina-voice/gemini-voice-base", {}, options);
  if (unitContext) {
    const ctx = await loadPrompt("carolina/carolina-voice/gemini-voice-unit-context", { unitContext }, options);
    return `${base}\n\n${ctx}`;
  }
  const general = await loadPrompt("carolina/carolina-voice/gemini-voice-general-mode", {}, options);
  return `${base}\n\n${general}`;
}
