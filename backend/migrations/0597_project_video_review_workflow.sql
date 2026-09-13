-- 0597_project_video_review_workflow.sql
-- Video Room: one canonical review workflow for team members and clients.
-- Adds rich feedback, decision history and revocable public review links.

BEGIN;

CREATE TABLE IF NOT EXISTS project_video_versions (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL,
  version_label text,
  version_number int NOT NULL DEFAULT 1,
  file_url text,
  b2_key text,
  stream_uid text,
  thumbnail_url text,
  duration numeric,
  chapters jsonb,
  status text NOT NULL DEFAULT 'under_review',
  uploaded_by varchar,
  content_type text,
  size_bytes bigint,
  upload_expires_at timestamptz,
  storage_version_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_video_comments (
  id uuid PRIMARY KEY,
  version_id uuid NOT NULL,
  project_id uuid NOT NULL,
  timecode_sec numeric NOT NULL DEFAULT 0,
  end_timecode_sec numeric,
  comment text NOT NULL,
  author_name text,
  author_email text,
  author_user_id varchar,
  author_kind text NOT NULL DEFAULT 'creator',
  category text,
  priority text,
  status text NOT NULL DEFAULT 'open',
  is_decision boolean NOT NULL DEFAULT false,
  parent_id uuid,
  annotation jsonb,
  suggested_media_url text,
  suggested_media_label text,
  suggested_media_from_sec numeric,
  suggested_media_to_sec numeric,
  like_count int NOT NULL DEFAULT 0,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_video_comments
  ADD COLUMN IF NOT EXISTS author_email text,
  ADD COLUMN IF NOT EXISTS author_user_id varchar,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS annotation jsonb,
  ADD COLUMN IF NOT EXISTS suggested_media_url text,
  ADD COLUMN IF NOT EXISTS suggested_media_label text,
  ADD COLUMN IF NOT EXISTS suggested_media_from_sec numeric,
  ADD COLUMN IF NOT EXISTS suggested_media_to_sec numeric,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE TABLE IF NOT EXISTS project_video_decisions (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL,
  version_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'changes_requested')),
  note text,
  actor_user_id varchar,
  reviewer_name text,
  reviewer_email text,
  source text NOT NULL DEFAULT 'team' CHECK (source IN ('team', 'client')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_video_share_links (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_by varchar,
  access_mode text NOT NULL DEFAULT 'comment' CHECK (access_mode IN ('view', 'comment', 'approve')),
  allow_version_history boolean NOT NULL DEFAULT true,
  require_identity boolean NOT NULL DEFAULT true,
  allow_download boolean NOT NULL DEFAULT false,
  password_salt text,
  password_hash text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_video_versions_project
  ON project_video_versions(project_id, version_number);
CREATE INDEX IF NOT EXISTS idx_project_video_comments_version_time
  ON project_video_comments(version_id, timecode_sec, created_at);
CREATE INDEX IF NOT EXISTS idx_project_video_comments_parent
  ON project_video_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_video_decisions_version
  ON project_video_decisions(version_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_video_share_links_project
  ON project_video_share_links(project_id, created_at DESC);

COMMIT;
