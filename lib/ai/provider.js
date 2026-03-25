import * as anthropic from "./providers/anthropic.js";
import * as openai from "./providers/openai.js";

const providers = { anthropic, openai };

export function getProvider(name) {
  const p = providers[name];
  if (!p) throw new Error(`Unknown AI provider: ${name}`);
  return p;
}
