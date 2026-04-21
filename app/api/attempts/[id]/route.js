import { createClient } from "@supabase/supabase-js";
import { countWords } from "../../../../src/lib/redaccion/word-count.js";

function getSupabase(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export async function PATCH(req, { params }) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body;
  try { body = await req.json(); } catch { body = {}; }

  if (typeof body.essay !== "string") {
    return Response.json({ error: "essay must be a string" }, { status: 400 });
  }

  const essay = body.essay;
  const word_count = countWords(essay);

  // Reject edits to a submitted attempt. Once a correction is requested, the
  // essay is frozen — the submit endpoint sets submitted_at atomically.
  const { data: existing, error: fetchErr } = await supabase
    .from("attempts")
    .select("id, submitted_at")
    .eq("id", id)
    .single();
  if (fetchErr) {
    if (fetchErr.code === "PGRST116") return Response.json({ error: "Attempt not found" }, { status: 404 });
    return Response.json({ error: fetchErr.message }, { status: 500 });
  }
  if (existing.submitted_at) {
    return Response.json({ error: "Attempt already submitted" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("attempts")
    .update({ essay, word_count, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, essay, word_count, updated_at")
    .single();

  if (error) {
    if (error.code === "PGRST116") return Response.json({ error: "Attempt not found" }, { status: 404 });
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json(data);
}
