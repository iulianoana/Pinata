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

// Session 1: brief is a placeholder. Session 2 replaces this with real LLM output.
const MOCK_TITLES = [
  "Mi familia y yo",
  "Mi rutina diaria",
  "Mis planes del fin de semana",
  "Un día típico",
  "Los gustos de mi pareja",
];

function buildMockBrief() {
  const title = MOCK_TITLES[Math.floor(Math.random() * MOCK_TITLES.length)];
  return {
    title,
    brief: {
      title,
      prompt: "Escribe un párrafo corto usando el vocabulario y la gramática de esta lección.",
      targetWordCount: 150,
      difficulty: "beginner",
      _mock: true,
    },
  };
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
    .select("id")
    .eq("id", lesson_id)
    .single();
  if (lessonError || !lesson) {
    return Response.json({ error: "Lesson not found or access denied" }, { status: 404 });
  }

  const { title, brief } = buildMockBrief();

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      user_id: user.id,
      lesson_id,
      scope,
      title,
      brief,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
