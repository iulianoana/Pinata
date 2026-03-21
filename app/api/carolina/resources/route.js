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

// List available weeks and lessons for the attachment picker
export async function GET(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: weeks, error: weeksError } = await supabase
    .from("weeks")
    .select("id, week_number, title")
    .order("week_number", { ascending: true });

  if (weeksError) return Response.json({ error: weeksError.message }, { status: 500 });

  // Fetch lessons grouped by week
  const weekIds = weeks.map((w) => w.id);
  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, week_id, title, sort_order")
    .in("week_id", weekIds)
    .order("sort_order", { ascending: true });

  if (lessonsError) return Response.json({ error: lessonsError.message }, { status: 500 });

  // Group lessons under their weeks
  const result = weeks.map((w) => ({
    ...w,
    type: "week",
    lessons: (lessons || [])
      .filter((l) => l.week_id === w.id)
      .map((l) => ({ id: l.id, title: l.title, type: "lesson" })),
  }));

  return Response.json(result);
}
