import { createClient } from "@supabase/supabase-js";
import { generateBrief } from "@/lib/redaccion/generate-brief.js";

function getSupabase(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export async function POST(req, { params }) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: assignment, error: assignErr } = await supabase
    .from("assignments")
    .select("id, lesson_id, scope")
    .eq("id", id)
    .single();
  if (assignErr || !assignment) {
    const status = assignErr?.code === "PGRST116" ? 404 : 500;
    return Response.json({ error: assignErr?.message || "Assignment not found" }, { status });
  }

  const { data: lesson, error: lessonErr } = await supabase
    .from("lessons")
    .select("id, title, markdown_content, week_id, sort_order")
    .eq("id", assignment.lesson_id)
    .single();
  if (lessonErr || !lesson) {
    return Response.json({ error: "Lesson not found or access denied" }, { status: 404 });
  }

  let unitLessons = null;
  if (assignment.scope === "unit" && lesson.week_id) {
    const { data: siblings, error: siblingsErr } = await supabase
      .from("lessons")
      .select("id, title, markdown_content, sort_order")
      .eq("week_id", lesson.week_id)
      .order("sort_order", { ascending: true });
    if (siblingsErr) {
      return Response.json({ error: siblingsErr.message }, { status: 500 });
    }
    unitLessons = siblings || [];
  }

  let generated;
  try {
    generated = await generateBrief({
      supabase,
      userId: user.id,
      lesson,
      unitLessons,
      scope: assignment.scope,
    });
  } catch (e) {
    console.error("[assignments/regenerate] generation failed:", e);
    return Response.json({ error: "Failed to regenerate assignment" }, { status: 502 });
  }

  const { data: updated, error: updateErr } = await supabase
    .from("assignments")
    .update({
      title: generated.title,
      brief: generated.brief,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });
  return Response.json(updated);
}
