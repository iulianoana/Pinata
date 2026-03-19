CREATE TABLE chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_name TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  duration_seconds INTEGER DEFAULT 0,
  turn_count INTEGER DEFAULT 0,
  transcript JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, started_at DESC);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions" ON chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);
