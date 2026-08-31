BEGIN;

-- Mention inboxes were originally keyed by a client-supplied display name.
-- Bind new delivery/read state to immutable account and project identities.
CREATE TABLE IF NOT EXISTS storyboard_mention_notifications (
  id BIGSERIAL PRIMARY KEY,
  project_id VARCHAR(255),
  mentioned_user_id VARCHAR(255),
  mentioned_name VARCHAR(120) NOT NULL,
  mentioned_email VARCHAR(255),
  author VARCHAR(120),
  comment_text TEXT,
  manuscript_id VARCHAR(160) NOT NULL,
  scene_id VARCHAR(160) NOT NULL,
  frame_id VARCHAR(160) NOT NULL,
  comment_id VARCHAR(160),
  shot_number VARCHAR(40),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE storyboard_mention_notifications
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mentioned_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS comment_id VARCHAR(160);

-- Membership expiry/deactivation is part of the tenant boundary used by both
-- manuscript authorization and mention delivery. Older installations created
-- these columns at runtime; converge them before the new predicates ship.
ALTER TABLE casting_user_roles
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- users.email uniqueness is case-sensitive. Backfill only when exactly one
-- account owns the normalized email; never choose arbitrarily between
-- case-colliding accounts or merge users by non-unique display names. Legacy
-- rows without an unambiguous account remain unavailable to the in-app inbox.
WITH unique_email_users AS (
  SELECT lower(btrim(email)) AS email_key, min(id::text) AS user_id
    FROM users
   WHERE email IS NOT NULL AND btrim(email) <> ''
   GROUP BY lower(btrim(email))
  HAVING COUNT(*) = 1
)
UPDATE storyboard_mention_notifications n
   SET mentioned_user_id = u.user_id
  FROM unique_email_users u
 WHERE n.mentioned_user_id IS NULL
   AND n.mentioned_email IS NOT NULL
   AND u.email_key = lower(btrim(n.mentioned_email));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'storyboard_mentions_project_id_fkey'
       AND conrelid = 'storyboard_mention_notifications'::regclass
  ) THEN
    ALTER TABLE storyboard_mention_notifications
      ADD CONSTRAINT storyboard_mentions_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES casting_projects(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'storyboard_mentions_user_id_fkey'
       AND conrelid = 'storyboard_mention_notifications'::regclass
  ) THEN
    ALTER TABLE storyboard_mention_notifications
      ADD CONSTRAINT storyboard_mentions_user_id_fkey
      FOREIGN KEY (mentioned_user_id) REFERENCES users(id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

ALTER TABLE storyboard_mention_notifications
  VALIDATE CONSTRAINT storyboard_mentions_project_id_fkey;
ALTER TABLE storyboard_mention_notifications
  VALIDATE CONSTRAINT storyboard_mentions_user_id_fkey;

DROP INDEX IF EXISTS idx_sb_mentions_name;

CREATE INDEX IF NOT EXISTS idx_sb_mentions_recipient
  ON storyboard_mention_notifications
    (mentioned_user_id, read_at, created_at DESC)
  WHERE mentioned_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sb_mentions_project
  ON storyboard_mention_notifications (project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sb_mentions_delivery_dedupe
  ON storyboard_mention_notifications
    (mentioned_user_id, frame_id, comment_id)
  WHERE mentioned_user_id IS NOT NULL AND comment_id IS NOT NULL;

COMMIT;
