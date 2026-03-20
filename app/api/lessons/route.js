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

  const weekId = new URL(req.url).searchParams.get("week_id");
  if (!weekId) return Response.json({ error: "week_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("lessons")
    .select("id, title, markdown_content, sort_order, created_at")
    .eq("week_id", weekId)
    .order("sort_order", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { week_id, title, markdown_content } = body;

  // Auto-assign sort_order
  const { data: existing } = await supabase
    .from("lessons")
    .select("sort_order")
    .eq("week_id", week_id)
    .order("sort_order", { ascending: false })
    .limit(1);

  const sort_order = existing?.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from("lessons")
    .insert({ user_id: user.id, week_id, title, markdown_content: markdown_content || "", sort_order })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
