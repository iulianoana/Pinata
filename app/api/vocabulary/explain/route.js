export async function POST(req) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "AI not configured" }, { status: 500 });
  }

  // Auth check
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    // Support both { word: "..." } and { words: ["...", "..."] }
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
{"original": "...", "corrected_word": "...", "explanation_es": "...", "explanation_en": "..."}

Return the results in the same order as the input words.`
      : `You are a Spanish language expert. The user will give you a Spanish word or phrase (which may contain spelling mistakes or missing accents).

Your job:
1. Correct the word — fix any spelling errors, add proper accents/tildes. Return the corrected form.
2. Write a brief Spanish explanation (2-3 sentences, markdown formatted). Include the meaning and a short example sentence using the word in context. Use *italics* for the example sentence.
3. Write a brief English explanation (2-3 sentences, markdown formatted). Include the meaning and a short example sentence using the word in context. Use *italics* for the example sentence.

Respond ONLY with a JSON object (no markdown, no backticks):
{"corrected_word": "...", "explanation_es": "...", "explanation_en": "..."}`;

    const userContent = isBulk ? words.join(", ") : words[0];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("OpenAI error:", res.status, errBody);
      return Response.json(
        { error: `OpenAI error: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";

    try {
      const parsed = JSON.parse(raw);

      if (isBulk) {
        // Return array of results
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

      // Single word response
      return Response.json({
        corrected_word: parsed.corrected_word || words[0],
        explanation_es: parsed.explanation_es || null,
        explanation_en: parsed.explanation_en || null,
      });
    } catch {
      return Response.json(
        { error: "Failed to parse AI response" },
        { status: 502 }
      );
    }
  } catch (e) {
    return Response.json({ error: "Explain failed" }, { status: 500 });
  }
}
