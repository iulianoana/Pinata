import { createClient } from "@supabase/supabase-js";
import { getProvider } from "../../../../lib/ai/provider.js";
import { getUserModel } from "../../../../lib/ai/get-user-model.js";
import { loadPrompt } from "../../../../lib/ai/prompts/load-prompt.js";

function getSupabase(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export async function POST(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    const words = body.words
      ? body.words.map((w) => w.trim()).filter(Boolean)
      : body.word
        ? [body.word.trim()]
        : [];

    if (words.length === 0) {
      return Response.json({ error: "word(s) required" }, { status: 400 });
    }

    const isBulk = words.length > 1;

    const promptOpts = { supabase, userId: user.id };
    const systemPrompt = isBulk
      ? await loadPrompt("vocab/vocab-explain-bulk", {}, promptOpts)
      : await loadPrompt("vocab/vocab-explain-single", {}, promptOpts);

    const userContent = isBulk ? words.join(", ") : words[0];

    // Get user's model preference
    const { model_id, provider } = await getUserModel(supabase, user.id, "vocabulary");
    const ai = getProvider(provider);

    const { content: raw } = await ai.generate({
      model: model_id,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    try {
      const parsed = JSON.parse(raw);

      if (isBulk) {
        const results = Array.isArray(parsed)
          ? parsed.map((item, i) => ({
              original: item.original || words[i],
              corrected_word: item.corrected_word || words[i],
              explanation_es: item.explanation_es || null,
              explanation_en: item.explanation_en || null,
            }))
          : words.map((w) => ({
              original: w,
              corrected_word: w,
              explanation_es: null,
              explanation_en: null,
            }));
        return Response.json({ results });
      }

      return Response.json({
        corrected_word: parsed.corrected_word || words[0],
        explanation_es: parsed.explanation_es || null,
        explanation_en: parsed.explanation_en || null,
      });
    } catch {
      return Response.json({ error: "Failed to parse AI response" }, { status: 502 });
    }
  } catch (e) {
    return Response.json({ error: "Explain failed" }, { status: 500 });
  }
}
