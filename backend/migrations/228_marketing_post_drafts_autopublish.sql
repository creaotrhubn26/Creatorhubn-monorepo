-- 228_marketing_post_drafts_autopublish.sql
--
-- PR 11: Auto-publish scheduler — drafts med suggested_publish_time
-- triggerer automatisk publisering ved planlagt tidspunkt, men kun hvis
-- admin eksplisitt har huket av "auto-publiser".
--
-- Idempotent.

ALTER TABLE marketing_post_drafts
  ADD COLUMN IF NOT EXISTS auto_publish_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE marketing_post_drafts
  ADD COLUMN IF NOT EXISTS auto_publish_attempted_at TIMESTAMPTZ;

ALTER TABLE marketing_post_drafts
  ADD COLUMN IF NOT EXISTS auto_publish_attempts INTEGER NOT NULL DEFAULT 0;

-- Partielt index for scheduler-lookup: kun drafts som er enabled +
-- har et suggested-time + ikke allerede ferdig.
CREATE INDEX IF NOT EXISTS idx_marketing_post_drafts_autopublish_due
  ON marketing_post_drafts (suggested_publish_time)
  WHERE auto_publish_enabled = TRUE
    AND status IN ('draft', 'edited')
    AND suggested_publish_time IS NOT NULL;
