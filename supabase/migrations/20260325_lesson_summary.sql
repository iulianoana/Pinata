-- Add AI-generated summary fields to lessons table
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ;
