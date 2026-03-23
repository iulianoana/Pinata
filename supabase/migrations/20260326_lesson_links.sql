-- Create lesson_links table for saving URLs with metadata per lesson
CREATE TABLE lesson_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  domain TEXT NOT NULL,
  favicon_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_links_lesson_id ON lesson_links(lesson_id);

-- RLS
ALTER TABLE lesson_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY lesson_links_select ON lesson_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY lesson_links_insert ON lesson_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY lesson_links_delete ON lesson_links FOR DELETE USING (auth.uid() = user_id);
