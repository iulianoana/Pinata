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

export async function GET(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const lessonId = url.searchParams.get("lesson_id");
  if (!lessonId) {
    return Response.json({ error: "lesson_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("assignments")
    .select(`
      id, title, scope, created_at,
      attempts (
        id, version_number, word_count, submitted_at,
        corrections ( id )
      )
    `)
    .eq("lesson_id", lessonId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const assignments = (data || []).map((a) => {
    const attempts = a.attempts || [];
    let latest = null;
    if (attempts.length > 0) {
      latest = attempts.reduce((acc, at) =>
        !acc || at.version_number > acc.version_number ? at : acc, null);
    }
    const latest_attempt = latest
      ? {
          version_number: latest.version_number,
          word_count: latest.word_count,
          submitted_at: latest.submitted_at,
          status: latest.corrections && latest.corrections.length > 0 ? "Corregida" : "Borrador",
        }
      : null;

    return {
      id: a.id,
      title: a.title,
      scope: a.scope,
      created_at: a.created_at,
      latest_attempt,
    };
  });

  return Response.json(assignments);
}

export async function POST(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { lesson_id, scope } = body;

  if (!lesson_id || typeof lesson_id !== "string") {
    return Response.json({ error: "lesson_id is required" }, { status: 400 });
  }
  if (scope !== "single_lesson" && scope !== "unit") {
    return Response.json({ error: "scope must be 'single_lesson' or 'unit'" }, { status: 400 });
  }

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, title, markdown_content, week_id, sort_order")
    .eq("id", lesson_id)
    .single();
  if (lessonError || !lesson) {
    return Response.json({ error: "Lesson not found or access denied" }, { status: 404 });
  }

  let unitLessons = null;
  if (scope === "unit" && lesson.week_id) {
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
      scope,
    });
  } catch (e) {
    console.error("[assignments/POST] generation failed:", e);
    return Response.json({ error: "Failed to generate assignment" }, { status: 502 });
  }

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      user_id: user.id,
      lesson_id,
      scope,
      title: generated.title,
      brief: generated.brief,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
