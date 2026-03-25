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

export async function PUT(req, { params }) {
  const supabase = getSupabase(req);
  if (!supabase)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Fetch current state
  const { data: current, error: fetchError } = await supabase
    .from("user_prompts")
    .select("content, previous_content")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !current) {
    return Response.json({ error: "Prompt not found" }, { status: 404 });
  }

  if (!current.previous_content) {
    return Response.json(
      { error: "No previous version to undo" },
      { status: 400 }
    );
  }

  // Swap content and previous_content
  const { error } = await supabase
    .from("user_prompts")
    .update({
      content: current.previous_content,
      previous_content: current.content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error)
    return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    ok: true,
    content: current.previous_content,
    previous_content: current.content,
  });
}
