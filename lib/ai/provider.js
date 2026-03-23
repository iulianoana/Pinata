import { AnthropicProvider } from "./providers/anthropic.js";

/**
 * @typedef {{
 *   systemPrompt: string;
 *   userMessage: string;
 *   pdfBase64: string;
 *   pdfMediaType: string;
 *   maxTokens?: number;
 * }} GenerateFromPDFParams
 *
 * @typedef {{
 *   content: string;
 *   usage?: { inputTokens: number; outputTokens: number };
 * }} GenerateFromPDFResult
 *
 * @typedef {{
 *   generateFromPDF: (params: GenerateFromPDFParams) => Promise<GenerateFromPDFResult>;
 * }} AIProvider
 */

/** @returns {AIProvider} */
export function getAIProvider() {
  return new AnthropicProvider();
}
