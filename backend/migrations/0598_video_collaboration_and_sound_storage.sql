-- 0598_video_collaboration_and_sound_storage.sql
--
-- One private object contract for Sound Room browser uploads and Pro Tools
-- bounces, plus the collaboration primitives used by Video Room.  Legacy B2
-- rows remain readable and are copied through an auditable, non-destructive
-- migration queue; this migration never deletes source objects.

BEGIN;

ALTER TABLE role_room_storage_objects
  ADD COLUMN IF NOT EXISTS upload_strategy VARCHAR(20) NOT NULL DEFAULT 'single'
    CHECK (upload_strategy IN ('single', 'multipart', 'server_copy')),
  ADD COLUMN IF NOT EXISTS multipart_upload_id TEXT,
  ADD COLUMN IF NOT EXISTS multipart_part_size BIGINT,
  ADD COLUMN IF NOT EXISTS source_channel VARCHAR(40),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS legacy_source_provider VARCHAR(30),
  ADD COLUMN IF NOT EXISTS legacy_source_key TEXT;

CREATE INDEX IF NOT EXISTS role_room_storage_objects_multipart_idx
  ON role_room_storage_objects(multipart_upload_id)
  WHERE multipart_upload_id IS NOT NULL AND status = 'pending';

ALTER TABLE audio_review_versions
  ADD COLUMN IF NOT EXISTS storage_object_id UUID
    REFERENCES role_room_storage_objects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preview_storage_object_id UUID
    REFERENCES role_room_storage_objects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS waveform_peaks JSONB,
  ADD COLUMN IF NOT EXISTS storage_state VARCHAR(24) NOT NULL DEFAULT 'legacy'
    CHECK (storage_state IN ('legacy', 'uploading', 'verifying', 'processing', 'ready', 'failed')),
  ADD COLUMN IF NOT EXISTS checksum_sha256 CHAR(64),
  ADD COLUMN IF NOT EXISTS content_type TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS audio_review_versions_storage_object_idx
  ON audio_review_versions(storage_object_id)
  WHERE storage_object_id IS NOT NULL;

-- Companion-tabellene opprettes fortsatt idempotent av companion-modulen i
-- eldre installasjoner. En ren migreringsdatabase kan derfor mangle tabellen.
DO $$
BEGIN
  IF to_regclass('public.protools_companion_bounces') IS NOT NULL THEN
    ALTER TABLE protools_companion_bounces
      ADD COLUMN IF NOT EXISTS storage_object_id UUID
        REFERENCES role_room_storage_objects(id) ON DELETE SET NULL;
    ALTER TABLE protools_companion_bounces
      ADD COLUMN IF NOT EXISTS checksum_sha256 CHAR(64);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS role_room_storage_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_provider VARCHAR(30) NOT NULL,
  source_key TEXT NOT NULL,
  source_url TEXT,
  destination_object_id UUID
    REFERENCES role_room_storage_objects(id) ON DELETE SET NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id TEXT NOT NULL,
  expected_size_bytes BIGINT,
  expected_checksum_sha256 CHAR(64),
  copied_size_bytes BIGINT,
  copied_checksum_sha256 CHAR(64),
  state VARCHAR(24) NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued', 'copying', 'verifying', 'verified', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  verified_at TIMESTAMPTZ,
  source_deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_provider, source_key, entity_type, entity_id),
  CHECK (source_deleted_at IS NULL OR state = 'verified')
);

CREATE INDEX IF NOT EXISTS role_room_storage_migrations_state_idx
  ON role_room_storage_migrations(state, created_at);

ALTER TABLE project_video_versions
  ADD COLUMN IF NOT EXISTS storage_object_id UUID
    REFERENCES role_room_storage_objects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stream_ready BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stream_state VARCHAR(24) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS stream_error TEXT,
  ADD COLUMN IF NOT EXISTS stream_checked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS project_video_review_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  version_id UUID NOT NULL REFERENCES project_video_versions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number > 0),
  name TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'cancelled')),
  max_rounds INTEGER CHECK (max_rounds IS NULL OR max_rounds > 0),
  opened_by VARCHAR(255),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  UNIQUE (project_id, round_number)
);

ALTER TABLE project_video_comments
  ADD COLUMN IF NOT EXISTS review_round_id UUID
    REFERENCES project_video_review_rounds(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS project_video_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  version_id UUID NOT NULL REFERENCES project_video_versions(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES project_video_comments(id) ON DELETE SET NULL,
  review_round_id UUID REFERENCES project_video_review_rounds(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to_user_id VARCHAR(255),
  assigned_to_name TEXT,
  assigned_to_email TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
  priority VARCHAR(20) NOT NULL DEFAULT 'must-fix'
    CHECK (priority IN ('must-fix', 'nice-to-have', 'suggestion')),
  due_at TIMESTAMPTZ,
  source VARCHAR(30) NOT NULL DEFAULT 'video_comment',
  external_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS project_video_tasks_comment_unique
  ON project_video_tasks(comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_video_tasks_project_idx
  ON project_video_tasks(project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS project_video_approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  version_id UUID NOT NULL REFERENCES project_video_versions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  step_order INTEGER NOT NULL DEFAULT 0,
  required_approvals INTEGER NOT NULL DEFAULT 1 CHECK (required_approvals > 0),
  status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_review', 'approved', 'changes_requested', 'cancelled')),
  due_at TIMESTAMPTZ,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_video_approvers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES project_video_approval_steps(id) ON DELETE CASCADE,
  user_id VARCHAR(255),
  name TEXT,
  email TEXT NOT NULL,
  role TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'changes_requested', 'abstained')),
  note TEXT,
  token_hash CHAR(64) NOT NULL UNIQUE,
  acted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (step_id, email)
);

CREATE INDEX IF NOT EXISTS project_video_approval_steps_version_idx
  ON project_video_approval_steps(version_id, step_order);

CREATE TABLE IF NOT EXISTS project_video_marker_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  version_id UUID NOT NULL REFERENCES project_video_versions(id) ON DELETE CASCADE,
  editor VARCHAR(20) NOT NULL CHECK (editor IN ('resolve', 'premiere', 'final_cut', 'generic')),
  external_marker_id TEXT NOT NULL,
  comment_id UUID REFERENCES project_video_comments(id) ON DELETE SET NULL,
  task_id UUID REFERENCES project_video_tasks(id) ON DELETE SET NULL,
  timecode_sec NUMERIC NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  note TEXT,
  color TEXT,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sync_revision BIGINT NOT NULL DEFAULT 1,
  last_direction VARCHAR(12) NOT NULL DEFAULT 'inbound'
    CHECK (last_direction IN ('inbound', 'outbound')),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (version_id, editor, external_marker_id)
);

CREATE INDEX IF NOT EXISTS project_video_marker_sync_revision_idx
  ON project_video_marker_sync(version_id, editor, sync_revision);

CREATE TABLE IF NOT EXISTS project_video_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  version_id UUID NOT NULL REFERENCES project_video_versions(id) ON DELETE CASCADE,
  host_user_id VARCHAR(255) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'live'
    CHECK (status IN ('live', 'ended')),
  playhead_sec NUMERIC NOT NULL DEFAULT 0,
  is_playing BOOLEAN NOT NULL DEFAULT FALSE,
  drawing JSONB,
  revision BIGINT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '8 hours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS project_video_live_session_one_active_idx
  ON project_video_live_sessions(project_id)
  WHERE status = 'live';

CREATE TABLE IF NOT EXISTS project_video_transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES project_video_versions(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  start_sec NUMERIC NOT NULL,
  end_sec NUMERIC NOT NULL,
  text TEXT NOT NULL,
  speaker TEXT,
  confidence NUMERIC,
  language VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (version_id, segment_index)
);

CREATE INDEX IF NOT EXISTS project_video_transcript_text_idx
  ON project_video_transcript_segments USING GIN (to_tsvector('simple', text));

CREATE TABLE IF NOT EXISTS project_video_caption_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES project_video_versions(id) ON DELETE CASCADE,
  language VARCHAR(20) NOT NULL DEFAULT 'no',
  label TEXT NOT NULL DEFAULT 'Norsk',
  kind VARCHAR(20) NOT NULL DEFAULT 'subtitles',
  format VARCHAR(10) NOT NULL DEFAULT 'vtt' CHECK (format IN ('vtt', 'srt')),
  content TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'ready'
    CHECK (status IN ('queued', 'inprogress', 'ready', 'error')),
  generated BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (version_id, language, format)
);

CREATE TABLE IF NOT EXISTS project_video_qc_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  version_id UUID NOT NULL REFERENCES project_video_versions(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'passed', 'warning', 'failed')),
  profile VARCHAR(40) NOT NULL DEFAULT 'web_delivery',
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  probe JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS project_video_qc_version_idx
  ON project_video_qc_results(version_id, created_at DESC);

ALTER TABLE project_video_share_links
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS watermark_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS watermark_text TEXT,
  ADD COLUMN IF NOT EXISTS review_round_id UUID
    REFERENCES project_video_review_rounds(id) ON DELETE SET NULL;

COMMIT;
