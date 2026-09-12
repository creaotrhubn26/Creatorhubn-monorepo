-- Review Room precision layer: semantic element offsets, visual marks and mention tracking.
-- Additive and backwards compatible with review data created by 0455.

ALTER TABLE mockup_studio_comments
  ADD COLUMN IF NOT EXISTS anchor_offset_x REAL,
  ADD COLUMN IF NOT EXISTS anchor_offset_y REAL,
  ADD COLUMN IF NOT EXISTS marks JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  ALTER TABLE mockup_studio_comments
    ADD CONSTRAINT mockup_studio_comments_anchor_offset_x_check
    CHECK (anchor_offset_x IS NULL OR (anchor_offset_x >= 0 AND anchor_offset_x <= 1));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE mockup_studio_comments
    ADD CONSTRAINT mockup_studio_comments_anchor_offset_y_check
    CHECK (anchor_offset_y IS NULL OR (anchor_offset_y >= 0 AND anchor_offset_y <= 1));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE mockup_studio_comments
    ADD CONSTRAINT mockup_studio_comments_marks_array_check
    CHECK (jsonb_typeof(marks) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS mockup_studio_comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES mockup_studio_comments(id) ON DELETE CASCADE,
  mentioned_user_id TEXT,
  mentioned_reviewer_session_id UUID REFERENCES mockup_studio_review_sessions(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (mentioned_user_id IS NOT NULL OR mentioned_reviewer_session_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS mockup_studio_comment_mentions_user_key
  ON mockup_studio_comment_mentions (comment_id, mentioned_user_id)
  WHERE mentioned_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mockup_studio_comment_mentions_reviewer_key
  ON mockup_studio_comment_mentions (comment_id, mentioned_reviewer_session_id)
  WHERE mentioned_reviewer_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mockup_studio_comment_mentions_reviewer_idx
  ON mockup_studio_comment_mentions (mentioned_reviewer_session_id, created_at DESC)
  WHERE mentioned_reviewer_session_id IS NOT NULL;
