import { getProvider } from "../../../lib/ai/provider.js";
import { getUserModel } from "../../../lib/ai/get-user-model.js";
import { loadPrompt } from "../../../lib/ai/prompts/load-prompt.js";
import { correctionSchema, correctionJsonSchema } from "./correction-schema.js";

function normalizeWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}

function reassembleSegments(segments) {
  return segments
    .map((seg) => (seg.type === "ok" ? seg.text : seg.original))
    .join("");
}

async function callAndValidate({ ai, model, system, schemaName, essay }) {
  const { data } = await ai.generateStructured({
    model,
    system,
    messages: [{ role: "user", content: "Corrige esta redacción ahora." }],
    schema: correctionJsonSchema,
    schemaName,
    maxTokens: 4096,
  });

  const parsed = correctionSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid correction at ${issue.path.join(".")}: ${issue.message}`);
  }

  const reassembled = reassembleSegments(parsed.data.segments);
  if (normalizeWhitespace(reassembled) !== normalizeWhitespace(essay)) {
    throw new Error("Correction segments do not reassemble to the submitted essay");
  }

  return parsed.data;
}

export async function correctAttempt({ supabase, userId, brief, essay }) {
  const { model_id, provider } = await getUserModel(supabase, userId, "redaccion_correction");
  const ai = getProvider(provider);

  const system = await loadPrompt(
    "redaccion/correction",
    {
      brief: JSON.stringify(brief, null, 2),
      essay,
    },
    { supabase, userId },
  );

  try {
    return await callAndValidate({ ai, model: model_id, system, schemaName: "redaccion_correction", essay });
  } catch (firstErr) {
    console.warn("[redaccion/correct-attempt] first attempt failed, retrying once:", firstErr.message);
    return await callAndValidate({ ai, model: model_id, system, schemaName: "redaccion_correction", essay });
  }
}
