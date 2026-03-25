import { DEFAULT_MODEL } from "./models.js";

export async function getUserModel(supabase, userId, feature) {
  const { data } = await supabase
    .from("user_models")
    .select("model_id, provider")
    .eq("user_id", userId)
    .eq("feature", feature)
    .single();

  if (data) return data;
  return { model_id: DEFAULT_MODEL.id, provider: DEFAULT_MODEL.provider };
}
