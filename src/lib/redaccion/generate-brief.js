import { getProvider } from "../../../lib/ai/provider.js";
import { getUserModel } from "../../../lib/ai/get-user-model.js";
import { loadPrompt } from "../../../lib/ai/prompts/load-prompt.js";
import { briefSchema, briefJsonSchema } from "./brief-schema.js";

const EXTENSION_MIN = 180;
const EXTENSION_MAX = 220;

function buildLessonContent(lesson, unitLessons) {
  if (unitLessons && unitLessons.length > 0) {
    return unitLessons
      .map((l) => `# ${l.title}\n\n${l.markdown_content || "(sin contenido)"}`)
      .join("\n\n---\n\n");
  }
  return `# ${lesson.title}\n\n${lesson.markdown_content || "(sin contenido)"}`;
}

async function callAndValidate({ ai, model, system, schemaName }) {
  const { data } = await ai.generateStructured({
    model,
    system,
    messages: [{ role: "user", content: "Genera el brief ahora." }],
    schema: briefJsonSchema,
    schemaName,
    maxTokens: 2048,
  });
  const parsed = briefSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid brief at ${issue.path.join(".")}: ${issue.message}`);
  }
  return parsed.data;
}

export async function generateBrief({ supabase, userId, lesson, unitLessons, scope }) {
  const { model_id, provider } = await getUserModel(supabase, userId, "redaccion_generation");
  const ai = getProvider(provider);

  const lessonContent = buildLessonContent(lesson, unitLessons);
  const scopeLabel = scope === "unit" ? "Unidad completa (varias lecciones)" : "Una sola lección";

  const system = await loadPrompt(
    "redaccion/generation",
    {
      scope: scopeLabel,
      extensionMin: String(EXTENSION_MIN),
      extensionMax: String(EXTENSION_MAX),
      lessonContent,
    },
    { supabase, userId },
  );

  let brief;
  try {
    brief = await callAndValidate({ ai, model: model_id, system, schemaName: "redaccion_brief" });
  } catch (firstErr) {
    console.warn("[redaccion/generate-brief] first attempt failed, retrying once:", firstErr.message);
    brief = await callAndValidate({ ai, model: model_id, system, schemaName: "redaccion_brief" });
  }

  brief.extensionMin = EXTENSION_MIN;
  brief.extensionMax = EXTENSION_MAX;

  return { title: brief.titulo, brief };
}
