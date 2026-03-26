import { createClient } from "@supabase/supabase-js";
import { getProvider } from "../../../../../../lib/ai/provider.js";
import { getUserModel } from "../../../../../../lib/ai/get-user-model.js";
import { loadPrompt } from "../../../../../../lib/ai/prompts/load-prompt.js";
import { aiResponseSchema } from "@/lib/conjugar/schemas.js";
import { SPANISH_TENSES } from "@/lib/conjugar/constants.js";

function getSupabase(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

function stripCodeFences(text) {
  return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

export async function POST(req, { params }) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { packId } = await params;

    // Fetch existing pack
    const { data: pack, error: packErr } = await supabase
      .from("drill_packs")
      .select("*")
      .eq("id", packId)
      .single();

    if (packErr) {
      const status = packErr.code === "PGRST116" ? 404 : 500;
      return Response.json({ error: packErr.message }, { status });
    }

    // Fetch the verb
    const { data: verb, error: verbErr } = await supabase
      .from("verbs")
      .select("*")
      .eq("id", pack.verb_id)
      .single();

    if (verbErr) return Response.json({ error: verbErr.message }, { status: 500 });

    const tenseLabel = SPANISH_TENSES.find((t) => t.id === pack.tense)?.label;

    // Get user model preference
    const { model_id, provider } = await getUserModel(supabase, user.id, "conjugar");
    const ai = getProvider(provider);

    const promptOpts = { supabase, userId: user.id };
    const systemPrompt = await loadPrompt("conjugar/generate-exercises", {}, promptOpts);

    const userMessage = `Verb: ${verb.infinitive} (${verb.verb_type}). Tense: ${tenseLabel} (${pack.tense}).`;

    const { content: raw } = await ai.generate({
      model: model_id,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 8192,
    });

    const cleaned = stripCodeFences(raw);
    let aiData;
    try {
      aiData = JSON.parse(cleaned);
    } catch {
      return Response.json({ error: "Failed to parse AI response" }, { status: 502 });
    }

    // Filter out deprecated exercise types the AI may still produce
    if (aiData.exercises) {
      aiData.exercises = aiData.exercises.filter((ex) => ex.type !== "conjugation_chain");
    }

    const validated = aiResponseSchema.safeParse(aiData);
    if (!validated.success) {
      return Response.json({ error: validated.error.issues[0].message }, { status: 502 });
    }

    // Keep existing classic_table, or build a new one from the conjugation table
    const existingClassicTable = pack.exercises.find((e) => e.type === "classic_table");
    const classicTable = existingClassicTable || {
      id: crypto.randomUUID(),
      type: "classic_table",
      verb: verb.infinitive,
      tense: pack.tense,
      tenseLabel,
      answers: validated.data.conjugationTable,
    };

    const exercises = [
      classicTable,
      ...validated.data.exercises.map((ex) => ({ ...ex, id: crypto.randomUUID() })),
    ];

    const { data: updated, error: updateErr } = await supabase
      .from("drill_packs")
      .update({ exercises, updated_at: new Date().toISOString() })
      .eq("id", packId)
      .select()
      .single();

    if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });
    return Response.json(updated);
  } catch (e) {
    console.error("[conjugar/regenerate] Error:", e);
    return Response.json({ error: "Failed to regenerate exercises" }, { status: 500 });
  }
}
