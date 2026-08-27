-- Mockup Studio Review Room — immutable review rounds, anchored feedback and collaboration.
-- Extends migration 0454 without altering its migrator-owned project table.
-- The runtime owner has CRUD but not ALTER/REFERENCES on that table, so
-- collaboration state is kept in an owner-scoped extension table.

CREATE TABLE IF NOT EXISTS mockup_studio_project_state (
  project_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  campaign_id TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  workspace_project_id TEXT,
  active_review_version_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, created_by)
);
INSERT INTO mockup_studio_project_state (project_id, created_by)
SELECT id, created_by FROM demo_studio_mockup_projects
ON CONFLICT (project_id, created_by) DO NOTHING;
CREATE INDEX IF NOT EXISTS mockup_studio_project_state_workspace_idx
  ON mockup_studio_project_state (workspace_project_id) WHERE workspace_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mockup_studio_project_state_owner_campaign_idx
  ON mockup_studio_project_state (created_by, campaign_id) WHERE campaign_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS mockup_studio_versions (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  label TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, created_by)
    REFERENCES mockup_studio_project_state (project_id, created_by) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS mockup_studio_versions_owner_project_idx
  ON mockup_studio_versions (created_by, project_id, created_at DESC);

ALTER TABLE mockup_studio_versions
  ADD COLUMN IF NOT EXISTS source_revision INTEGER,
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_by_user_id TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT;
DO $$ BEGIN
  ALTER TABLE mockup_studio_versions
    ADD CONSTRAINT mockup_studio_versions_review_status_check
    CHECK (review_status IN ('draft','in_review','changes_requested','approved','superseded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS mockup_studio_share_links (
  token_hash TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  FOREIGN KEY (project_id, created_by)
    REFERENCES mockup_studio_project_state (project_id, created_by) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS mockup_studio_share_links_owner_project_idx
  ON mockup_studio_share_links (created_by, project_id) WHERE revoked_at IS NULL;

ALTER TABLE mockup_studio_share_links
  ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS version_id BIGINT,
  ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'approve',
  ADD COLUMN IF NOT EXISTS require_identity BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_recordings BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_version_history BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS comments_paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS mockup_studio_share_links_id_key ON mockup_studio_share_links (id);
CREATE INDEX IF NOT EXISTS mockup_studio_share_links_version_idx ON mockup_studio_share_links (version_id) WHERE revoked_at IS NULL;
DO $$ BEGIN
  ALTER TABLE mockup_studio_share_links
    ADD CONSTRAINT mockup_studio_share_links_access_mode_check
    CHECK (access_mode IN ('view','comment','approve'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE mockup_studio_share_links
    ADD CONSTRAINT mockup_studio_share_links_version_fk
    FOREIGN KEY (version_id) REFERENCES mockup_studio_versions(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE mockup_studio_project_state
    ADD CONSTRAINT mockup_studio_project_state_active_review_fk
    FOREIGN KEY (active_review_version_id) REFERENCES mockup_studio_versions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS mockup_studio_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  user_id TEXT,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'commenter'
    CHECK (role IN ('editor','commenter','approver','viewer')),
  invited_by_user_id TEXT NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, created_by)
    REFERENCES mockup_studio_project_state (project_id, created_by) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS mockup_studio_collaborators_project_email_key
  ON mockup_studio_collaborators (project_id, created_by, lower(email)) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS mockup_studio_collaborators_user_idx
  ON mockup_studio_collaborators (user_id, revoked_at) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS mockup_studio_review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token_hash TEXT NOT NULL REFERENCES mockup_studio_share_links(token_hash) ON DELETE CASCADE,
  reviewer_token_hash TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mockup_studio_review_sessions_share_idx
  ON mockup_studio_review_sessions (share_token_hash, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS mockup_studio_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  version_id BIGINT NOT NULL REFERENCES mockup_studio_versions(id) ON DELETE CASCADE,
  comment_number INTEGER NOT NULL,
  parent_id UUID REFERENCES mockup_studio_comments(id) ON DELETE CASCADE,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('user','reviewer','system')),
  author_user_id TEXT,
  reviewer_session_id UUID REFERENCES mockup_studio_review_sessions(id) ON DELETE SET NULL,
  author_display_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  anchor_kind TEXT NOT NULL DEFAULT 'general' CHECK (anchor_kind IN ('general','canvas','element')),
  anchor_ref TEXT,
  anchor_x REAL,
  anchor_y REAL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','wontfix')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, created_by)
    REFERENCES mockup_studio_project_state (project_id, created_by) ON DELETE CASCADE,
  CHECK (anchor_x IS NULL OR (anchor_x >= 0 AND anchor_x <= 1)),
  CHECK (anchor_y IS NULL OR (anchor_y >= 0 AND anchor_y <= 1)),
  CHECK ((anchor_kind = 'general') OR (anchor_x IS NOT NULL AND anchor_y IS NOT NULL)),
  UNIQUE (version_id, comment_number)
);
CREATE INDEX IF NOT EXISTS mockup_studio_comments_version_status_idx
  ON mockup_studio_comments (version_id, status, created_at);
CREATE INDEX IF NOT EXISTS mockup_studio_comments_project_updated_idx
  ON mockup_studio_comments (created_by, project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS mockup_studio_comments_parent_idx
  ON mockup_studio_comments (parent_id, created_at) WHERE parent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS mockup_studio_comment_reactions (
  comment_id UUID NOT NULL REFERENCES mockup_studio_comments(id) ON DELETE CASCADE,
  actor_key TEXT NOT NULL,
  emoji TEXT NOT NULL CHECK (length(emoji) BETWEEN 1 AND 32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, actor_key, emoji)
);

CREATE TABLE IF NOT EXISTS mockup_studio_comment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES mockup_studio_comments(id) ON DELETE CASCADE,
  file_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  is_recording BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mockup_studio_comment_attachments_comment_idx
  ON mockup_studio_comment_attachments (comment_id, created_at);

CREATE TABLE IF NOT EXISTS mockup_studio_review_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  version_id BIGINT NOT NULL REFERENCES mockup_studio_versions(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved','changes_requested','reset')),
  note TEXT,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('user','reviewer','system')),
  actor_user_id TEXT,
  reviewer_session_id UUID REFERENCES mockup_studio_review_sessions(id) ON DELETE SET NULL,
  actor_display_name TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, created_by)
    REFERENCES mockup_studio_project_state (project_id, created_by) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS mockup_studio_review_decisions_version_idx
  ON mockup_studio_review_decisions (version_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mockup_studio_presence (
  project_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  version_id BIGINT NOT NULL REFERENCES mockup_studio_versions(id) ON DELETE CASCADE,
  participant_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  cursor_x REAL,
  cursor_y REAL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (version_id, participant_key),
  FOREIGN KEY (project_id, created_by)
    REFERENCES mockup_studio_project_state (project_id, created_by) ON DELETE CASCADE,
  CHECK (cursor_x IS NULL OR (cursor_x >= 0 AND cursor_x <= 1)),
  CHECK (cursor_y IS NULL OR (cursor_y >= 0 AND cursor_y <= 1))
);
CREATE INDEX IF NOT EXISTS mockup_studio_presence_active_idx
  ON mockup_studio_presence (version_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS mockup_studio_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  version_id BIGINT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, created_by)
    REFERENCES mockup_studio_project_state (project_id, created_by) ON DELETE CASCADE,
  FOREIGN KEY (version_id) REFERENCES mockup_studio_versions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS mockup_studio_notifications_recipient_idx
  ON mockup_studio_notifications (recipient_user_id, seen_at, created_at DESC);

CREATE TABLE IF NOT EXISTS mockup_studio_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  url TEXT NOT NULL,
  signing_secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_delivered_at TIMESTAMPTZ,
  last_status_code INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, created_by)
    REFERENCES mockup_studio_project_state (project_id, created_by) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS mockup_studio_webhooks_project_idx
  ON mockup_studio_webhook_subscriptions (created_by, project_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS mockup_studio_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES mockup_studio_webhook_subscriptions(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('delivered','failed')),
  status_code INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mockup_studio_webhook_deliveries_subscription_idx
  ON mockup_studio_webhook_deliveries (subscription_id, created_at DESC);
