import { createClient } from "@supabase/supabase-js";

function getSupabase(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

// Single-attempt model: one Attempt per Assignment.
//   - If an attempt exists, return it (regardless of submitted_at) along with
//     its correction, if any. View state on the client is derived from
//     `submitted_at` and `correction`.
//   - If no attempt exists, create v1 and return it.
// RLS enforces that the bearer owns the assignment.
export async function POST(req, { params }) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: assignmentId } = await params;

  const { data: assignment, error: assignErr } = await supabase
    .from("assignments")
    .select("id")
    .eq("id", assignmentId)
    .single();
  if (assignErr) {
    if (assignErr.code === "PGRST116") return Response.json({ error: "Assignment not found" }, { status: 404 });
    return Response.json({ error: assignErr.message }, { status: 500 });
  }

  const { data: existing, error: queryErr } = await supabase
    .from("attempts")
    .select("id, version_number, essay, word_count, submitted_at")
    .eq("assignment_id", assignmentId)
    .order("version_number", { ascending: false })
    .limit(1);
  if (queryErr) return Response.json({ error: queryErr.message }, { status: 500 });

  const latest = existing?.[0];
  if (latest) {
    const { data: correction } = await supabase
      .from("corrections")
      .select("id, segments, summary, score_grammar, score_vocabulary, score_structure, created_at")
      .eq("attempt_id", latest.id)
      .maybeSingle();
    return Response.json({ ...latest, correction: correction || null });
  }

  const { data: created, error: insertErr } = await supabase
    .from("attempts")
    .insert({
      assignment_id: assignmentId,
      version_number: 1,
      essay: "",
      word_count: 0,
    })
    .select("id, version_number, essay, word_count, submitted_at")
    .single();

  if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 });
  return Response.json({ ...created, correction: null });
}
