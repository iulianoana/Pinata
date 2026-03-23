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

export async function GET(req, { params }) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { lessonId } = await params;
  const { data, error } = await supabase
    .from("lesson_links")
    .select("id, url, title, domain, favicon_url, created_at")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(req, { params }) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { lessonId } = await params;
  const body = await req.json();
  const { url, title, domain, faviconUrl } = body;

  if (!url || !title || !domain) {
    return Response.json({ error: "url, title, and domain are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lesson_links")
    .insert({
      user_id: user.id,
      lesson_id: lessonId,
      url,
      title,
      domain,
      favicon_url: faviconUrl || null,
    })
    .select("id, url, title, domain, favicon_url, created_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
