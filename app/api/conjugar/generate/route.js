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
    { global: { headers: { Authorization: `Bearer ${token}` } } }
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

    // Fetch verbs
    const { data: verbs, error: verbsErr } = await supabase
      .from("verbs")
      .select("*")
      .in("id", verbIds);

    if (verbsErr) return Response.json({ error: verbsErr.message }, { status: 500 });
    if (!verbs || verbs.length === 0) {
      return Response.json({ error: "Verbs not found" }, { status: 404 });
    }

    // Get user model preference for conjugar feature
    const { model_id, provider } = await getUserModel(supabase, user.id, "conjugar");
    const ai = getProvider(provider);

    const promptOpts = { supabase, userId: user.id };
    const systemPrompt = await loadPrompt("conjugar/generate-exercises", {}, promptOpts);

    const packs = [];

    for (const verb of verbs) {
      const userMessage = `Verb: ${verb.infinitive} (${verb.verb_type}). Tense: ${tenseLabel} (${tense}).`;

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
        return Response.json(
          { error: `Failed to parse AI response for "${verb.infinitive}"` },
          { status: 502 }
        );
      }

      // Filter out deprecated exercise types the AI may still produce
      if (aiData.exercises) {
        aiData.exercises = aiData.exercises.filter((ex) => ex.type !== "conjugation_chain");
      }

      const validated = aiResponseSchema.safeParse(aiData);
      if (!validated.success) {
        return Response.json(
          { error: `Invalid AI response for "${verb.infinitive}": ${validated.error.issues[0].message}` },
          { status: 502 }
        );
      }

      // Build classic_table exercise programmatically from the conjugation table
      const classicTable = {
        id: crypto.randomUUID(),
        type: "classic_table",
        verb: verb.infinitive,
        tense,
        tenseLabel,
        answers: validated.data.conjugationTable,
      };

      // Assign IDs to AI-generated exercises
      const exercises = [
        classicTable,
        ...validated.data.exercises.map((ex) => ({ ...ex, id: crypto.randomUUID() })),
      ];

      // Upsert: if pack exists for this verb+tense, update exercises
      const { data: existing } = await supabase
        .from("drill_packs")
        .select("id")
        .eq("verb_id", verb.id)
        .eq("tense", tense)
        .eq("user_id", user.id)
        .maybeSingle();

      let pack;
      if (existing) {
        const { data, error } = await supabase
          .from("drill_packs")
          .update({ exercises, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        pack = data;
      } else {
        const { data, error } = await supabase
          .from("drill_packs")
          .insert({ user_id: user.id, verb_id: verb.id, tense, exercises })
          .select()
          .single();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        pack = data;
      }

      packs.push(pack);
    }

    return Response.json({ packs }, { status: 201 });
  } catch (e) {
    console.error("[conjugar/generate] Error:", e);
    return Response.json({ error: "Failed to generate exercises" }, { status: 500 });
  }
}
