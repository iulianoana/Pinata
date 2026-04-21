import { DEFAULT_MODEL, FEATURES, getModelById } from "./models.js";

export async function getUserModel(supabase, userId, feature) {
  const { data } = await supabase
    .from("user_models")
    .select("model_id, provider")
    .eq("user_id", userId)
    .eq("feature", feature)
    .single();

  if (data) return data;

  // Feature-specific default, if the FEATURES entry declares one.
  const featureEntry = FEATURES.find((f) => f.id === feature);
  if (featureEntry?.defaultModelId) {
    const model = getModelById(featureEntry.defaultModelId);
    return { model_id: model.id, provider: model.provider };
  }

  return { model_id: DEFAULT_MODEL.id, provider: DEFAULT_MODEL.provider };
}
