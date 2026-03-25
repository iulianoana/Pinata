import { createClient } from "@supabase/supabase-js";
import { collectPromptFiles } from "./seed/route.js";

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
  if (!supabase)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Check if user has any prompts
  let { data: prompts, error } = await supabase
    .from("user_prompts")
    .select("*")
    .eq("user_id", user.id)
    .order("group_key")
    .order("name");

  if (error)
    return Response.json({ error: error.message }, { status: 500 });

  // Backfill any missing prompts (new groups, new files added to codebase)
  const allRows = collectPromptFiles(user.id);
  const existingKeys = new Set(
    (prompts || []).map((r) => `${r.group_key}:${r.slug}`)
  );
  const toInsert = allRows.filter(
    (r) => !existingKeys.has(`${r.group_key}:${r.slug}`)
  );

  if (toInsert.length > 0) {
    const { error: seedError } = await supabase
      .from("user_prompts")
      .insert(toInsert);
    if (seedError)
      return Response.json({ error: seedError.message }, { status: 500 });

    // Re-fetch after seeding
    const result = await supabase
      .from("user_prompts")
      .select("*")
      .eq("user_id", user.id)
      .order("group_key")
      .order("name");
    prompts = result.data || [];
  }

  return Response.json({ prompts });
}
