-- Canonical music lineage and durable Sound Room -> Pro Tools actions.
--
-- A single artifact graph follows audio from an EaseVerse take, through a
-- Pro Tools import/bounce, into Sound Room review and finally keeper/master.
-- Commands are device-scoped and leaseable so feedback actions survive app,
-- network and machine restarts without being delivered to another tenant.

CREATE TABLE IF NOT EXISTS creatorhub_music_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(160),
  owner_user_id VARCHAR(64) NOT NULL,
  workspace_project_id VARCHAR(160),
  audio_review_project_id UUID REFERENCES audio_review_projects(id) ON DELETE SET NULL,
  easeverse_track_id VARCHAR(160),
  easeverse_project_id VARCHAR(160),
  companion_session_id UUID REFERENCES protools_companion_sessions(id) ON DELETE SET NULL,
  review_version_id UUID REFERENCES audio_review_versions(id) ON DELETE SET NULL,
  parent_artifact_id UUID REFERENCES creatorhub_music_artifacts(id) ON DELETE SET NULL,
  artifact_kind VARCHAR(24) NOT NULL,
  source_system VARCHAR(24) NOT NULL,
  source_artifact_id VARCHAR(240),
  file_name TEXT,
  file_url TEXT,
  storage_key TEXT,
  content_fingerprint VARCHAR(400),
  revision INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT creatorhub_music_artifact_kind_check
    CHECK (artifact_kind IN ('take','stem','mix','reference','keeper','master')),
  CONSTRAINT creatorhub_music_artifact_source_check
    CHECK (source_system IN ('easeverse','protools','sound_room')),
  CONSTRAINT creatorhub_music_artifact_status_check
    CHECK (status IN ('active','superseded','approved','archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS creatorhub_music_artifacts_source_uq
  ON creatorhub_music_artifacts(owner_user_id, source_system, source_artifact_id)
  WHERE source_artifact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS creatorhub_music_artifacts_workspace_idx
  ON creatorhub_music_artifacts(workspace_project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creatorhub_music_artifacts_audio_room_idx
  ON creatorhub_music_artifacts(audio_review_project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creatorhub_music_artifacts_track_idx
  ON creatorhub_music_artifacts(easeverse_track_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creatorhub_music_artifacts_parent_idx
  ON creatorhub_music_artifacts(parent_artifact_id);

CREATE TABLE IF NOT EXISTS protools_companion_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES protools_companion_sessions(id) ON DELETE CASCADE,
  device_token_id VARCHAR(160) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  command_kind VARCHAR(32) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key VARCHAR(300) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lock_token UUID,
  locked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  last_error TEXT,
  requested_by VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT protools_companion_command_kind_check
    CHECK (command_kind IN ('locate','create_marker','import_audio','export_review')),
  CONSTRAINT protools_companion_command_status_check
    CHECK (status IN ('pending','processing','completed','failed')),
  CONSTRAINT protools_companion_command_dedupe_uq UNIQUE(session_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS protools_companion_commands_due_idx
  ON protools_companion_commands(device_token_id, status, next_attempt_at, created_at);

ALTER TABLE protools_companion_sessions
  ADD COLUMN IF NOT EXISTS ptsl_session_id VARCHAR(160),
  ADD COLUMN IF NOT EXISTS ptsl_host_version VARCHAR(80),
  ADD COLUMN IF NOT EXISTS ptsl_status VARCHAR(24) NOT NULL DEFAULT 'unavailable',
  ADD COLUMN IF NOT EXISTS protools_tier VARCHAR(24) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS intro_preflight JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_ptsl_sync_at TIMESTAMPTZ;

ALTER TABLE protools_companion_bounces
  ADD COLUMN IF NOT EXISTS artifact_id UUID REFERENCES creatorhub_music_artifacts(id) ON DELETE SET NULL;

ALTER TABLE audio_review_comments
  ADD COLUMN IF NOT EXISTS protools_marker_id VARCHAR(160),
  ADD COLUMN IF NOT EXISTS protools_sync_status VARCHAR(24),
  ADD COLUMN IF NOT EXISTS protools_synced_at TIMESTAMPTZ;

INSERT INTO creatorhub_music_artifacts (
  organization_id,owner_user_id,workspace_project_id,audio_review_project_id,easeverse_track_id,easeverse_project_id,
  companion_session_id,review_version_id,artifact_kind,source_system,source_artifact_id,file_name,file_url,storage_key,
  content_fingerprint,metadata,created_by,created_at
)
SELECT s.organization_id,s.user_id,s.workspace_project_id,s.audio_review_project_id,s.easeverse_track_id,s.easeverse_project_id,
       s.id,b.review_version_id,CASE WHEN s.session_type='mastering' THEN 'master' ELSE 'mix' END,'protools',
       'bounce:'||b.id::text,b.file_name,b.file_url,b.storage_key,b.content_fingerprint,
       jsonb_build_object('durationSeconds',b.duration_seconds),s.user_id,b.created_at
  FROM protools_companion_bounces b JOIN protools_companion_sessions s ON s.id=b.session_id
ON CONFLICT(owner_user_id,source_system,source_artifact_id) WHERE source_artifact_id IS NOT NULL DO NOTHING;

UPDATE protools_companion_bounces b SET artifact_id=a.id
  FROM creatorhub_music_artifacts a
 WHERE a.source_system='protools' AND a.source_artifact_id='bounce:'||b.id::text AND b.artifact_id IS NULL;

INSERT INTO creatorhub_music_artifacts (
  owner_user_id,workspace_project_id,audio_review_project_id,easeverse_track_id,review_version_id,
  artifact_kind,source_system,source_artifact_id,file_name,file_url,status,metadata,created_by,created_at
)
SELECT p.owner_user_id,par.project_id::text,p.id,p.easeverse_track_id,v.id,
       CASE WHEN lower(v.version_label) LIKE '%keeper%' THEN 'keeper' ELSE 'mix' END,
       CASE WHEN lower(COALESCE(v.uploaded_by,''))='easeverse' THEN 'easeverse' ELSE 'sound_room' END,
       'review-version:'||v.id::text,v.file_name,v.file_url,
       CASE WHEN v.status='approved' THEN 'approved' WHEN v.status='superseded' THEN 'superseded' ELSE 'active' END,
       jsonb_build_object('versionNumber',v.version_number,'versionLabel',v.version_label),p.owner_user_id,v.created_at
  FROM audio_review_versions v
  JOIN audio_review_projects p ON p.id=v.project_id
  LEFT JOIN project_audio_rooms par ON par.audio_review_project_id=p.id
 WHERE NOT EXISTS (SELECT 1 FROM creatorhub_music_artifacts a WHERE a.review_version_id=v.id)
ON CONFLICT(owner_user_id,source_system,source_artifact_id) WHERE source_artifact_id IS NOT NULL DO NOTHING;
