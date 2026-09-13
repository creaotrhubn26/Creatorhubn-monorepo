-- Auditable review comment -> working-copy changes.
-- Every apply/undo command is append-only; immutable review comments and
-- snapshots stay untouched while the current storyboard frame is patched.

CREATE UNIQUE INDEX IF NOT EXISTS storyboard_review_comments_id_round_key
  ON storyboard_review_comments (id, review_round_id);

CREATE TABLE IF NOT EXISTS storyboard_review_comment_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_round_id UUID NOT NULL,
  comment_id UUID NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  manuscript_id VARCHAR(255) NOT NULL,
  scene_id VARCHAR(255) NOT NULL,
  frame_id VARCHAR(255) NOT NULL,
  operation VARCHAR(16) NOT NULL CHECK (operation IN ('apply', 'undo')),
  forward_patch JSONB NOT NULL,
  inverse_patch JSONB NOT NULL,
  before_hash CHAR(64) NOT NULL CHECK (before_hash ~ '^[0-9a-f]{64}$'),
  after_hash CHAR(64) NOT NULL CHECK (after_hash ~ '^[0-9a-f]{64}$'),
  reverts_change_id UUID REFERENCES storyboard_review_comment_changes(id) ON DELETE RESTRICT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (review_round_id, project_id, manuscript_id)
    REFERENCES storyboard_review_rounds (id, project_id, manuscript_id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id, review_round_id)
    REFERENCES storyboard_review_comments (id, review_round_id) ON DELETE CASCADE,
  CHECK (jsonb_typeof(forward_patch) = 'object'),
  CHECK (jsonb_typeof(inverse_patch) = 'object'),
  CHECK (
    (operation = 'apply' AND reverts_change_id IS NULL)
    OR (operation = 'undo' AND reverts_change_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS storyboard_review_comment_changes_comment_idx
  ON storyboard_review_comment_changes (comment_id, created_at);

CREATE INDEX IF NOT EXISTS storyboard_review_comment_changes_round_idx
  ON storyboard_review_comment_changes (review_round_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS storyboard_review_comment_changes_single_undo_idx
  ON storyboard_review_comment_changes (reverts_change_id)
  WHERE operation = 'undo';

CREATE OR REPLACE FUNCTION protect_storyboard_review_comment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'storyboard review comment changes are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_storyboard_review_comment_change_mutation
  ON storyboard_review_comment_changes;
CREATE TRIGGER protect_storyboard_review_comment_change_mutation
  BEFORE UPDATE OR DELETE ON storyboard_review_comment_changes
  FOR EACH ROW EXECUTE FUNCTION protect_storyboard_review_comment_change();
