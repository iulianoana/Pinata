-- Carolina text chat: extend chat_sessions + create chat_messages table

-- 1. Add columns to chat_sessions
ALTER TABLE chat_sessions
  ADD COLUMN type TEXT NOT NULL DEFAULT 'voice' CHECK (type IN ('voice', 'chat')),
  ADD COLUMN title TEXT,
  ADD COLUMN mode TEXT CHECK (mode IN ('essay', 'grammar', 'vocab', 'conversation')),
  ADD COLUMN starred BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN resources JSONB,
  ADD COLUMN model TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- Indexes for chat session queries
CREATE INDEX idx_chat_sessions_user_type ON chat_sessions (user_id, type, updated_at DESC);
CREATE INDEX idx_chat_sessions_starred ON chat_sessions (user_id, starred) WHERE starred = true;

-- Allow users to delete their own sessions
CREATE POLICY "Users can delete own sessions" ON chat_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- 2. Create chat_messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('spanish', content)
  ) STORED
);

CREATE INDEX idx_chat_messages_session ON chat_messages (session_id, created_at ASC);
CREATE INDEX idx_chat_messages_search ON chat_messages USING GIN (search_vector);

-- 3. RLS for chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages"
  ON chat_messages FOR SELECT
  USING (session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own messages"
  ON chat_messages FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid()));

-- 4. Search RPC function
CREATE OR REPLACE FUNCTION search_chat_messages(
  search_query TEXT,
  user_id_param UUID,
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  message_id UUID,
  session_id UUID,
  session_title TEXT,
  session_mode TEXT,
  role TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id AS message_id,
    cm.session_id,
    cs.title AS session_title,
    cs.mode AS session_mode,
    cm.role,
    cm.content,
    cm.created_at,
    ts_rank(cm.search_vector, plainto_tsquery('spanish', search_query)) AS rank
  FROM chat_messages cm
  JOIN chat_sessions cs ON cs.id = cm.session_id
  WHERE cs.user_id = user_id_param
    AND cs.type = 'chat'
    AND cm.search_vector @@ plainto_tsquery('spanish', search_query)
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Auto-generate title + update updated_at trigger
CREATE OR REPLACE FUNCTION auto_generate_chat_title()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'user' THEN
    -- Set title from first user message if not yet set
    UPDATE chat_sessions
    SET title = LEFT(NEW.content, 80),
        updated_at = now()
    WHERE id = NEW.session_id
      AND title IS NULL;
  END IF;

  -- Always update updated_at
  UPDATE chat_sessions
  SET updated_at = now()
  WHERE id = NEW.session_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_title_and_updated
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_chat_title();
