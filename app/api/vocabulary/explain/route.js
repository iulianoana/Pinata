import { createClient } from "@supabase/supabase-js";
import { getProvider } from "../../../../lib/ai/provider.js";
import { getUserModel } from "../../../../lib/ai/get-user-model.js";

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

    const systemPrompt = isBulk
      ? `You are a Spanish language expert. The user will give you a list of Spanish words or phrases (which may contain spelling mistakes or missing accents).

For EACH word:
1. Correct the word — fix any spelling errors, add proper accents/tildes. Return the corrected form.
2. Write a brief Spanish explanation (2-3 sentences, markdown formatted). Include the meaning and a short example sentence using the word in context. Use *italics* for the example sentence.
3. Write a brief English explanation (2-3 sentences, markdown formatted). Include the meaning and a short example sentence using the word in context. Use *italics* for the example sentence.

Respond ONLY with a JSON array (no markdown, no backticks). Each element must have:
{"original": "...", "corrected_word": "...", "explanation_es": "...", "explanation_en": "..."}\n\nReturn the results in the same order as the input words.`
      : `You are a Spanish language expert. The user will give you a Spanish word or phrase (which may contain spelling mistakes or missing accents).

Your job:
1. Correct the word — fix any spelling errors, add proper accents/tildes. Return the corrected form.
2. Write a brief Spanish explanation (2-3 sentences, markdown formatted). Include the meaning and a short example sentence using the word in context. Use *italics* for the example sentence.
3. Write a brief English explanation (2-3 sentences, markdown formatted). Include the meaning and a short example sentence using the word in context. Use *italics* for the example sentence.

Respond ONLY with a JSON object (no markdown, no backticks):
{"corrected_word": "...", "explanation_es": "...", "explanation_en": "..."}`;

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
