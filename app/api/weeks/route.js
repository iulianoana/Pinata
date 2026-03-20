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

export async function GET(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("weeks")
    .select("*, lessons(id)")
    .order("week_number", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const weeks = data.map((w) => ({
    id: w.id,
    user_id: w.user_id,
    week_number: w.week_number,
    title: w.title,
    markdown_content: w.markdown_content,
    created_at: w.created_at,
    updated_at: w.updated_at,
    lesson_count: w.lessons?.length || 0,
  }));

  return Response.json(weeks);
}

export async function POST(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { week_number, title } = body;

  const { data, error } = await supabase
    .from("weeks")
    .insert({ user_id: user.id, week_number, title: title || "" })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
