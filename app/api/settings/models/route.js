import { createClient } from "@supabase/supabase-js";
import { MODEL_OPTIONS, DEFAULT_MODEL, FEATURES } from "../../../../lib/ai/models.js";

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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rows } = await supabase
    .from("user_models")
    .select("feature, model_id, display_name, provider")
    .eq("user_id", user.id);

  const byFeature = {};
  for (const r of rows || []) {
    byFeature[r.feature] = r;
  }

  // Fill defaults for missing features
  const result = {};
  for (const f of FEATURES) {
    result[f.id] = byFeature[f.id] || {
      feature: f.id,
      model_id: DEFAULT_MODEL.id,
      display_name: DEFAULT_MODEL.displayName,
      provider: DEFAULT_MODEL.provider,
    };
  }

  return Response.json(result);
}

export async function PUT(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { feature, model_id } = await req.json();

  if (!FEATURES.find((f) => f.id === feature)) {
    return Response.json({ error: "Invalid feature" }, { status: 400 });
  }

  const model = MODEL_OPTIONS.find((m) => m.id === model_id);
  if (!model) {
    return Response.json({ error: "Invalid model" }, { status: 400 });
  }

  const { error } = await supabase.from("user_models").upsert(
    {
      user_id: user.id,
      feature,
      model_id: model.id,
      display_name: model.displayName,
      provider: model.provider,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,feature" }
  );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
