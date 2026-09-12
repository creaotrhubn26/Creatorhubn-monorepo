-- Storyboard Room review rounds.
-- A round is an immutable, server-authored snapshot of the storyboard state.
-- Share tokens and reviewer session tokens are stored as SHA-256 hashes only.

CREATE UNIQUE INDEX IF NOT EXISTS casting_manuscripts_id_project_key
  ON casting_manuscripts (id, project_id);

CREATE TABLE IF NOT EXISTS storyboard_review_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  manuscript_id VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  label VARCHAR(180) NOT NULL,
  summary TEXT,
  snapshot JSONB NOT NULL,
  snapshot_hash CHAR(64) NOT NULL CHECK (snapshot_hash ~ '^[0-9a-f]{64}$'),
  script_fingerprint CHAR(64) NOT NULL CHECK (script_fingerprint ~ '^[0-9a-f]{64}$'),
  status VARCHAR(32) NOT NULL DEFAULT 'in_review'
    CHECK (status IN ('in_review', 'changes_requested', 'approved', 'superseded')),
  frame_count INTEGER NOT NULL DEFAULT 0 CHECK (frame_count >= 0),
  total_duration_seconds NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (total_duration_seconds >= 0),
  created_by VARCHAR(255) NOT NULL,
  approved_by VARCHAR(255),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (manuscript_id, version),
  UNIQUE (id, project_id, manuscript_id),
  FOREIGN KEY (manuscript_id, project_id)
    REFERENCES casting_manuscripts (id, project_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS storyboard_review_rounds_project_idx
  ON storyboard_review_rounds (project_id, manuscript_id, version DESC);
CREATE INDEX IF NOT EXISTS storyboard_review_rounds_status_idx
  ON storyboard_review_rounds (project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS storyboard_review_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_round_id UUID NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  manuscript_id VARCHAR(255) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  access_mode VARCHAR(16) NOT NULL DEFAULT 'comment'
    CHECK (access_mode IN ('view', 'comment', 'approve')),
  require_identity BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (review_round_id, project_id, manuscript_id)
    REFERENCES storyboard_review_rounds (id, project_id, manuscript_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS storyboard_review_share_links_round_idx
  ON storyboard_review_share_links (review_round_id, created_at DESC);
CREATE INDEX IF NOT EXISTS storyboard_review_share_links_active_idx
  ON storyboard_review_share_links (token_hash)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS storyboard_review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES storyboard_review_share_links(id) ON DELETE CASCADE,
  reviewer_token_hash CHAR(64) NOT NULL UNIQUE CHECK (reviewer_token_hash ~ '^[0-9a-f]{64}$'),
  display_name VARCHAR(180) NOT NULL,
  email VARCHAR(320),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS storyboard_review_sessions_share_idx
  ON storyboard_review_sessions (share_link_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS storyboard_review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_round_id UUID NOT NULL REFERENCES storyboard_review_rounds(id) ON DELETE CASCADE,
  frame_id VARCHAR(255),
  parent_id UUID REFERENCES storyboard_review_comments(id) ON DELETE CASCADE,
  author_kind VARCHAR(16) NOT NULL CHECK (author_kind IN ('user', 'reviewer')),
  author_user_id VARCHAR(255),
  reviewer_session_id UUID REFERENCES storyboard_review_sessions(id) ON DELETE SET NULL,
  author_display_name VARCHAR(180) NOT NULL,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  visibility VARCHAR(16) NOT NULL DEFAULT 'client'
    CHECK (visibility IN ('client', 'team')),
  anchor_x REAL,
  anchor_y REAL,
  status VARCHAR(16) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved')),
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (anchor_x IS NULL OR (anchor_x >= 0 AND anchor_x <= 1)),
  CHECK (anchor_y IS NULL OR (anchor_y >= 0 AND anchor_y <= 1))
);
CREATE INDEX IF NOT EXISTS storyboard_review_comments_round_idx
  ON storyboard_review_comments (review_round_id, status, created_at);
CREATE INDEX IF NOT EXISTS storyboard_review_comments_frame_idx
  ON storyboard_review_comments (review_round_id, frame_id, created_at)
  WHERE frame_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS storyboard_review_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_round_id UUID NOT NULL REFERENCES storyboard_review_rounds(id) ON DELETE CASCADE,
  decision VARCHAR(24) NOT NULL CHECK (decision IN ('approved', 'changes_requested')),
  expected_snapshot_hash CHAR(64) NOT NULL CHECK (expected_snapshot_hash ~ '^[0-9a-f]{64}$'),
  actor_kind VARCHAR(16) NOT NULL CHECK (actor_kind IN ('user', 'reviewer')),
  actor_user_id VARCHAR(255),
  reviewer_session_id UUID REFERENCES storyboard_review_sessions(id) ON DELETE SET NULL,
  actor_display_name VARCHAR(180) NOT NULL,
  note TEXT CHECK (note IS NULL OR length(note) <= 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS storyboard_review_decisions_round_idx
  ON storyboard_review_decisions (review_round_id, created_at DESC);

CREATE OR REPLACE FUNCTION protect_storyboard_review_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.manuscript_id IS DISTINCT FROM OLD.manuscript_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
     OR NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash
     OR NEW.script_fingerprint IS DISTINCT FROM OLD.script_fingerprint
     OR NEW.frame_count IS DISTINCT FROM OLD.frame_count
     OR NEW.total_duration_seconds IS DISTINCT FROM OLD.total_duration_seconds
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'storyboard review snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_storyboard_review_snapshot_update ON storyboard_review_rounds;
CREATE TRIGGER protect_storyboard_review_snapshot_update
  BEFORE UPDATE ON storyboard_review_rounds
  FOR EACH ROW EXECUTE FUNCTION protect_storyboard_review_snapshot();

CREATE OR REPLACE FUNCTION protect_storyboard_review_decision()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'storyboard review decisions are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_storyboard_review_decision_change ON storyboard_review_decisions;
CREATE TRIGGER protect_storyboard_review_decision_change
  BEFORE UPDATE OR DELETE ON storyboard_review_decisions
  FOR EACH ROW EXECUTE FUNCTION protect_storyboard_review_decision();
