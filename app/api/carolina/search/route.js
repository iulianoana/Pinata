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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  if (!q || !q.trim()) return Response.json({ error: "q parameter is required" }, { status: 400 });

  const { data, error } = await supabase.rpc("search_chat_messages", {
    search_query: q.trim(),
    user_id_param: user.id,
    max_results: 20,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
