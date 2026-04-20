import { createClient } from "@supabase/supabase-js";

function getSupabase(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
}

// POST was removed — verb creation now happens atomically in
// /api/conjugar/generate-batch alongside AI pack generation to avoid orphan verbs.

export async function GET(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [verbsRes, packsRes, attemptsRes] = await Promise.all([
      supabase.from("verbs").select("*").order("created_at", { ascending: false }),
      supabase.from("drill_packs").select("id, verb_id, tense, created_at, updated_at"),
      supabase
        .from("drill_attempts")
        .select("pack_ids, percentage, grade, created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (verbsRes.error) return Response.json({ error: verbsRes.error.message }, { status: 500 });

    const packStats = {};
    for (const attempt of attemptsRes.data || []) {
      for (const packId of attempt.pack_ids) {
        if (!packStats[packId]) {
          packStats[packId] = { attemptCount: 0, lastPercentage: null, lastGrade: null };
        }
        packStats[packId].attemptCount++;
        if (packStats[packId].lastPercentage === null) {
          packStats[packId].lastPercentage = attempt.percentage;
          packStats[packId].lastGrade = attempt.grade;
        }
      }
    }

    const packsByVerb = {};
    for (const pack of packsRes.data || []) {
      if (!packsByVerb[pack.verb_id]) packsByVerb[pack.verb_id] = [];
      const stats = packStats[pack.id] || { attemptCount: 0, lastPercentage: null, lastGrade: null };
      packsByVerb[pack.verb_id].push({
        id: pack.id,
        tense: pack.tense,
        created_at: pack.created_at,
        updated_at: pack.updated_at,
        ...stats,
      });
    }

    const verbs = (verbsRes.data || []).map((verb) => ({
      ...verb,
      packs: packsByVerb[verb.id] || [],
    }));

    return Response.json({ verbs });
  } catch (e) {
    return Response.json({ error: "Failed to fetch verbs" }, { status: 500 });
  }
}
