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

export async function PATCH(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { updates } = await req.json();
  if (!Array.isArray(updates)) return Response.json({ error: "updates array required" }, { status: 400 });

  const results = await Promise.all(
    updates.map(({ id, sort_order }) =>
      supabase.from("lessons").update({ sort_order }).eq("id", id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed) return Response.json({ error: failed.error.message }, { status: 500 });
  return Response.json({ ok: true });
}
