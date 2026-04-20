import { createClient } from "@supabase/supabase-js";
import { getProvider } from "../../../../lib/ai/provider.js";
import { getUserModel } from "../../../../lib/ai/get-user-model.js";
import { loadPrompt } from "../../../../lib/ai/prompts/load-prompt.js";
import { aiResponseSchema } from "@/lib/conjugar/schemas.js";
import { SPANISH_TENSES, TENSE_IDS, detectVerbType } from "@/lib/conjugar/constants.js";

function getSupabase(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
}

function stripCodeFences(text) {
  return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

/**
 * Per-infinitive pipeline: detect type → call AI → validate → insert verb + pack.
 * Throws with a friendly message on any failure. Caller translates into `failed` entry.
 * Verb row is only inserted AFTER AI validation passes — no orphan verbs.
 */
async function generateOne({ infinitive, tense, tenseLabel, supabase, userId, ai, model_id, systemPrompt }) {
  const lower = infinitive.toLowerCase().trim();
  const verbType = detectVerbType(lower);
  if (!verbType) throw new Error("Invalid ending (-ar/-er/-ir)");

  // Check if a pack already exists for this (user, infinitive, tense) via existing verb row.
  const { data: existingVerb } = await supabase
    .from("verbs")
    .select("id")
    .eq("user_id", userId)
    .eq("infinitive", lower)
    .maybeSingle();

  if (existingVerb) {
    const { data: existingPack } = await supabase
      .from("drill_packs")
      .select("*")
      .eq("verb_id", existingVerb.id)
      .eq("tense", tense)
      .maybeSingle();
    if (existingPack) {
      // Already generated — skip AI and return existing.
      const { data: verbRow } = await supabase.from("verbs").select("*").eq("id", existingVerb.id).single();
      return { verb: verbRow, pack: existingPack, skipped: true };
    }
  }

  // AI generation
  let raw;
  try {
    const result = await ai.generate({
      model: model_id,
      system: systemPrompt,
      messages: [{ role: "user", content: `Verb: ${lower} (${verbType}). Tense: ${tenseLabel} (${tense}).` }],
      maxTokens: 8192,
    });
    raw = result.content;
  } catch (e) {
    throw new Error(`AI provider error: ${e.message || "unknown"}`);
  }

  let aiData;
  try {
    aiData = JSON.parse(stripCodeFences(raw));
  } catch {
    throw new Error("AI response couldn't be parsed");
  }

  if (aiData.exercises) {
    aiData.exercises = aiData.exercises.filter((ex) => ex.type !== "conjugation_chain");
  }

  const validated = aiResponseSchema.safeParse(aiData);
  if (!validated.success) {
    throw new Error(`Invalid AI response: ${validated.error.issues[0].message}`);
  }

  // Build the pack exercises
  const classicTable = {
    id: crypto.randomUUID(),
    type: "classic_table",
    verb: lower,
    tense,
    tenseLabel,
    answers: validated.data.conjugationTable,
    ...(validated.data.verbInfo && { verbInfo: validated.data.verbInfo }),
  };
  const exercises = [
    classicTable,
    ...validated.data.exercises.map((ex) => ({ ...ex, id: crypto.randomUUID() })),
  ];

  // Persist: upsert verb, then insert pack. Both in DB only after AI validation passes.
  const { data: verbRow, error: verbErr } = await supabase
    .from("verbs")
    .upsert(
      { user_id: userId, infinitive: lower, verb_type: verbType },
      { onConflict: "user_id,infinitive" },
    )
    .select()
    .single();
  if (verbErr) throw new Error(verbErr.message);

  const { data: pack, error: packErr } = await supabase
    .from("drill_packs")
    .insert({ user_id: userId, verb_id: verbRow.id, tense, exercises })
    .select()
    .single();
  if (packErr) throw new Error(packErr.message);

  return { verb: verbRow, pack };
}

export async function POST(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const infinitives = Array.isArray(body?.infinitives)
    ? body.infinitives.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
    : [];
  const tense = body?.tense;

  if (infinitives.length === 0) {
    return Response.json({ error: "No verbs provided" }, { status: 400 });
  }
  if (infinitives.length > 20) {
    return Response.json({ error: "Too many verbs (max 20)" }, { status: 400 });
  }
  if (!TENSE_IDS.includes(tense)) {
    return Response.json({ error: "Invalid tense" }, { status: 400 });
  }

  const tenseLabel = SPANISH_TENSES.find((t) => t.id === tense)?.label;

  const { model_id, provider } = await getUserModel(supabase, user.id, "conjugar");
  const ai = getProvider(provider);
  const systemPrompt = await loadPrompt(
    "conjugar/generate-exercises",
    {},
    { supabase, userId: user.id },
  );

  const created = [];
  const failed = [];

  for (const infinitive of infinitives) {
    try {
      const { verb, pack, skipped } = await generateOne({
        infinitive,
        tense,
        tenseLabel,
        supabase,
        userId: user.id,
        ai,
        model_id,
        systemPrompt,
      });
      created.push({ infinitive, verb, pack, skipped: !!skipped });
    } catch (e) {
      failed.push({ infinitive, error: e.message || "Unknown error" });
    }
  }

  return Response.json({ created, failed }, { status: 200 });
}
