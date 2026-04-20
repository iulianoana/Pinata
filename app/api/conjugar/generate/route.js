import { createClient } from "@supabase/supabase-js";
import { getProvider } from "../../../../lib/ai/provider.js";
import { getUserModel } from "../../../../lib/ai/get-user-model.js";
import { loadPrompt } from "../../../../lib/ai/prompts/load-prompt.js";
import { generatePacksSchema, aiResponseSchema } from "@/lib/conjugar/schemas.js";
import { SPANISH_TENSES } from "@/lib/conjugar/constants.js";

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

export async function POST(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = generatePacksSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { verbIds, tense } = parsed.data;
    const tenseLabel = SPANISH_TENSES.find((t) => t.id === tense)?.label;

    const { data: verbs, error: verbsErr } = await supabase
      .from("verbs")
      .select("*")
      .in("id", verbIds);

    if (verbsErr) return Response.json({ error: verbsErr.message }, { status: 500 });
    if (!verbs || verbs.length === 0) {
      return Response.json({ error: "Verbs not found" }, { status: 404 });
    }

    const { data: existingPacks } = await supabase
      .from("drill_packs")
      .select("id, verb_id, tense")
      .in("verb_id", verbIds)
      .eq("tense", tense);

    const existingVerbIds = new Set((existingPacks || []).map((p) => p.verb_id));
    const verbsToGenerate = verbs.filter((v) => !existingVerbIds.has(v.id));

    const { model_id, provider } = await getUserModel(supabase, user.id, "conjugar");
    const ai = getProvider(provider);
    const systemPrompt = await loadPrompt(
      "conjugar/generate-exercises",
      {},
      { supabase, userId: user.id },
    );

    const created = [];
    const failed = [];

    for (const verb of verbsToGenerate) {
      try {
        const { content: raw } = await ai.generate({
          model: model_id,
          system: systemPrompt,
          messages: [{ role: "user", content: `Verb: ${verb.infinitive} (${verb.verb_type}). Tense: ${tenseLabel} (${tense}).` }],
          maxTokens: 8192,
        });

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

        const classicTable = {
          id: crypto.randomUUID(),
          type: "classic_table",
          verb: verb.infinitive,
          tense,
          tenseLabel,
          answers: validated.data.conjugationTable,
          ...(validated.data.verbInfo && { verbInfo: validated.data.verbInfo }),
        };
        const exercises = [
          classicTable,
          ...validated.data.exercises.map((ex) => ({ ...ex, id: crypto.randomUUID() })),
        ];

        const { data: pack, error } = await supabase
          .from("drill_packs")
          .insert({ user_id: user.id, verb_id: verb.id, tense, exercises })
          .select()
          .single();
        if (error) throw new Error(error.message);

        created.push({ infinitive: verb.infinitive, verb, pack });
      } catch (e) {
        failed.push({ infinitive: verb.infinitive, error: e.message || "Unknown error" });
      }
    }

    // Include previously-existing packs in `packs` for backwards compat with callers expecting them.
    let existingFull = [];
    if (existingPacks && existingPacks.length > 0) {
      const { data } = await supabase
        .from("drill_packs")
        .select("*")
        .in("id", existingPacks.map((p) => p.id));
      existingFull = data || [];
    }

    const packs = [...existingFull, ...created.map((c) => c.pack)];
    return Response.json({ packs, created, failed }, { status: 200 });
  } catch (e) {
    console.error("[conjugar/generate] Error:", e);
    return Response.json({ error: "Failed to generate exercises" }, { status: 500 });
  }
}
