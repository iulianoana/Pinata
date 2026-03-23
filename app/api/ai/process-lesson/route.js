import { createClient } from "@supabase/supabase-js";
import { getAIProvider } from "../../../../lib/ai/provider.js";
import { LESSON_SUMMARY_PROMPT } from "../../../../lib/ai/prompts/lesson-summary.js";
import { getQuizPrompt } from "../../../../lib/ai/prompts/quiz-generator.js";

function getSupabase(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

/**
 * Strip markdown code fences from AI response if present.
 * The AI sometimes wraps JSON in ```json ... ``` blocks.
 */
function stripCodeFences(text) {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match ? match[1].trim() : trimmed;
}

/**
 * Validate that parsed quiz JSON has the expected structure.
 */
function validateQuizData(data) {
  if (!data || typeof data !== "object") return "Quiz data is not an object";
  if (!data.questions || !Array.isArray(data.questions)) return "Missing questions array";
  if (data.questions.length === 0) return "Questions array is empty";

  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    if (!q.type) return `Question ${i + 1} missing type`;
    if (!q.title) return `Question ${i + 1} missing title`;
    if (!q.prompt && !q.question) return `Question ${i + 1} missing prompt`;
  }

  return null;
}

export async function POST(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { lessonId, pdfStoragePath, generate, quizQuestionCount = 15 } = body;

  // Validation
  if (!lessonId || typeof lessonId !== "string") {
    return Response.json({ error: "lessonId is required" }, { status: 400 });
  }
  if (!pdfStoragePath || typeof pdfStoragePath !== "string") {
    return Response.json({ error: "pdfStoragePath is required" }, { status: 400 });
  }
  if (!generate || (!generate.summary && !generate.quiz)) {
    return Response.json({ error: "At least one of generate.summary or generate.quiz must be true" }, { status: 400 });
  }

  // Verify lesson exists and belongs to user
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, title, week_id")
    .eq("id", lessonId)
    .single();

  if (lessonError || !lesson) {
    return Response.json({ error: "Lesson not found or access denied" }, { status: 404 });
  }

  // Fetch PDF from Supabase Storage
  const { data: pdfData, error: pdfError } = await supabase.storage
    .from("lesson-pdfs")
    .download(pdfStoragePath);

  if (pdfError || !pdfData) {
    return Response.json(
      { error: `Failed to fetch PDF: ${pdfError?.message || "File not found"}` },
      { status: 404 }
    );
  }

  const pdfBuffer = Buffer.from(await pdfData.arrayBuffer());
  const pdfBase64 = pdfBuffer.toString("base64");

  const ai = getAIProvider();
  const tasks = [];

  // Build generation tasks
  if (generate.summary) {
    tasks.push({
      key: "summary",
      promise: ai.generateFromPDF({
        systemPrompt: LESSON_SUMMARY_PROMPT,
        userMessage: "Read this Spanish lesson PDF and generate a structured markdown summary following the format specified in your instructions.",
        pdfBase64,
        pdfMediaType: "application/pdf",
        maxTokens: 8192,
      }),
    });
  }

  if (generate.quiz) {
    tasks.push({
      key: "quiz",
      promise: ai.generateFromPDF({
        systemPrompt: getQuizPrompt(quizQuestionCount),
        userMessage: "Read this Spanish lesson PDF and generate a quiz JSON file following the format and rules specified in your instructions.",
        pdfBase64,
        pdfMediaType: "application/pdf",
        maxTokens: 16384,
      }),
    });
  }

  // Run tasks in parallel
  const settled = await Promise.allSettled(tasks.map((t) => t.promise));

  /** @type {Record<string, { status: string; quizId?: string; error?: string }>} */
  const results = {};

  for (let i = 0; i < tasks.length; i++) {
    const { key } = tasks[i];
    const result = settled[i];

    if (result.status === "rejected") {
      console.error(`[AI ${key}] Failed:`, result.reason);
      results[key] = { status: "error", error: result.reason?.message || "AI generation failed" };
      continue;
    }

    const { content, usage } = result.value;
    console.log(`[AI ${key}] Tokens — input: ${usage?.inputTokens ?? "?"}, output: ${usage?.outputTokens ?? "?"}`);

    if (key === "summary") {
      // Save summary to lesson record
      const { error: updateError } = await supabase
        .from("lessons")
        .update({ summary: content, summary_generated_at: new Date().toISOString() })
        .eq("id", lessonId);

      if (updateError) {
        console.error("[AI summary] DB save failed:", updateError);
        results.summary = { status: "error", error: `Failed to save summary: ${updateError.message}` };
      } else {
        results.summary = { status: "success" };
      }
    }

    if (key === "quiz") {
      // Parse and validate quiz JSON
      const rawJson = stripCodeFences(content);
      let quizData;
      try {
        quizData = JSON.parse(rawJson);
      } catch (parseError) {
        console.error("[AI quiz] JSON parse failed:", parseError.message);
        results.quiz = { status: "error", error: "AI returned invalid JSON" };
        continue;
      }

      const validationError = validateQuizData(quizData);
      if (validationError) {
        console.error("[AI quiz] Validation failed:", validationError);
        results.quiz = { status: "error", error: validationError };
        continue;
      }

      // Create quiz record
      const quizTitle = quizData.meta?.title || `Quiz: ${lesson.title}`;
      const quizDescription = quizData.meta?.description || null;

      const { data: newQuiz, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          user_id: user.id,
          title: quizTitle,
          description: quizDescription,
          lesson_id: lessonId,
          quiz_data: quizData,
          question_count: quizData.questions.length,
          source: "ai",
        })
        .select("id")
        .single();

      if (quizError) {
        console.error("[AI quiz] DB save failed:", quizError);
        results.quiz = { status: "error", error: `Failed to save quiz: ${quizError.message}` };
      } else {
        results.quiz = { status: "success", quizId: newQuiz.id };
      }
    }
  }

  // Fill in skipped tasks
  if (generate.summary && !results.summary) results.summary = { status: "skipped" };
  if (generate.quiz && !results.quiz) results.quiz = { status: "skipped" };

  return Response.json({ results });
}
