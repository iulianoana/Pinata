import { createClient } from "@supabase/supabase-js";
import { countWords } from "../../../../../src/lib/redaccion/word-count.js";
import { correctAttempt } from "../../../../../src/lib/redaccion/correct-attempt.js";

function getSupabase(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

// Idempotent: if a correction already exists, return it without calling the
// LLM. This lets the client re-fire on page reload mid-correction without
// risking duplicate work. If submitted_at is set but no correction exists,
// we treat it as a resume and call the LLM again.
export async function POST(req, { params }) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: attemptId } = await params;

  // Load attempt + its parent assignment's brief.
  const { data: attempt, error: attemptErr } = await supabase
    .from("attempts")
    .select("id, assignment_id, version_number, essay, word_count, submitted_at, assignment:assignments(id, brief)")
    .eq("id", attemptId)
    .single();
  if (attemptErr) {
    if (attemptErr.code === "PGRST116") return Response.json({ error: "Attempt not found" }, { status: 404 });
    return Response.json({ error: attemptErr.message }, { status: 500 });
  }

  // Idempotency short-circuit: if a correction already exists, return it.
  const { data: existing } = await supabase
    .from("corrections")
    .select("id, segments, summary, score_grammar, score_vocabulary, score_structure, created_at")
    .eq("attempt_id", attemptId)
    .maybeSingle();
  if (existing) {
    return Response.json({
      attempt: stripAssignment(attempt),
      correction: existing,
    });
  }

  const brief = attempt.assignment?.brief || {};
  const extensionMin = Number(brief.extensionMin) || 0;
  const threshold = Math.max(1, Math.round(extensionMin * 0.7));

  // Defensive server-side threshold guard — UI disables the button below this,
  // but a direct API call should also bounce.
  const wordCount = countWords(attempt.essay || "");
  if (wordCount < threshold) {
    return Response.json(
      { error: `Essay must be at least ${threshold} words (got ${wordCount})` },
      { status: 400 }
    );
  }

  // Mark as submitted if not already. This locks further PATCHes (see
  // app/api/attempts/[id]/route.js) and drives the client's "correcting" view
  // state on page reload.
  let submittedAt = attempt.submitted_at;
  if (!submittedAt) {
    const nowIso = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabase
      .from("attempts")
      .update({ submitted_at: nowIso, updated_at: nowIso })
      .eq("id", attemptId)
      .select("submitted_at")
      .single();
    if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });
    submittedAt = updated.submitted_at;
  }

  let correctionData;
  try {
    correctionData = await correctAttempt({
      supabase,
      userId: user.id,
      brief,
      essay: attempt.essay || "",
    });
  } catch (e) {
    console.error("[attempts/correct] LLM correction failed:", e);
    return Response.json({ error: "Failed to correct attempt" }, { status: 502 });
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("corrections")
    .insert({
      attempt_id: attemptId,
      segments: correctionData.segments,
      summary: correctionData.summary,
      score_grammar: correctionData.scoreGrammar,
      score_vocabulary: correctionData.scoreVocabulary,
      score_structure: correctionData.scoreStructure,
    })
    .select("id, segments, summary, score_grammar, score_vocabulary, score_structure, created_at")
    .single();

  // Race-safe: if another concurrent call inserted first, fetch and return that row.
  if (insertErr) {
    if (insertErr.code === "23505") {
      const { data: raced } = await supabase
        .from("corrections")
        .select("id, segments, summary, score_grammar, score_vocabulary, score_structure, created_at")
        .eq("attempt_id", attemptId)
        .maybeSingle();
      if (raced) {
        return Response.json({
          attempt: { ...stripAssignment(attempt), submitted_at: submittedAt },
          correction: raced,
        });
      }
    }
    return Response.json({ error: insertErr.message }, { status: 500 });
  }

  return Response.json({
    attempt: { ...stripAssignment(attempt), submitted_at: submittedAt },
    correction: inserted,
  });
}

function stripAssignment(attempt) {
  const { assignment, ...rest } = attempt;
  return rest;
}
