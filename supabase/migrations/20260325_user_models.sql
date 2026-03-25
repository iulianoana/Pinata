CREATE TABLE user_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, feature)
);

ALTER TABLE user_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own rows" ON user_models
  FOR ALL USING (auth.uid() = user_id);
