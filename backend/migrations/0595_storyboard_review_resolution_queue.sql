-- Resolution workflow for immutable storyboard review comments.
-- Comment content remains untouched; mutable task metadata lives beside it.

ALTER TABLE storyboard_review_comments
  ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(180),
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT,
  ADD COLUMN IF NOT EXISTS resolved_in_round_id UUID,
  ADD COLUMN IF NOT EXISTS carried_from_comment_id UUID;

DO $$ BEGIN
  ALTER TABLE storyboard_review_comments
    ADD CONSTRAINT storyboard_review_comments_resolution_note_length
    CHECK (resolution_note IS NULL OR length(resolution_note) <= 5000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE storyboard_review_comments
    ADD CONSTRAINT storyboard_review_comments_resolved_round_fk
    FOREIGN KEY (resolved_in_round_id)
    REFERENCES storyboard_review_rounds(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE storyboard_review_comments
    ADD CONSTRAINT storyboard_review_comments_carried_from_fk
    FOREIGN KEY (carried_from_comment_id)
    REFERENCES storyboard_review_comments(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS storyboard_review_comments_open_due_idx
  ON storyboard_review_comments (review_round_id, due_at, created_at)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS storyboard_review_comments_carried_from_idx
  ON storyboard_review_comments (carried_from_comment_id)
  WHERE carried_from_comment_id IS NOT NULL;
