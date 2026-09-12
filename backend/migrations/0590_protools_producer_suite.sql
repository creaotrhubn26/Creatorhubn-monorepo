-- 0590_protools_producer_suite.sql
-- Durable Pro Tools session recall, audio QC and delivery jobs.

CREATE TABLE IF NOT EXISTS protools_session_snapshots (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID NOT NULL REFERENCES protools_companion_sessions(id) ON DELETE CASCADE,
  user_id                 VARCHAR(64) NOT NULL,
  review_version_id       UUID REFERENCES audio_review_versions(id) ON DELETE SET NULL,
  fingerprint             CHAR(64) NOT NULL,
  reason                  VARCHAR(32) NOT NULL DEFAULT 'manual'
                          CHECK (reason IN ('manual','session_opened','session_changed','pre_publish','pre_recall','post_recall','intro_copy')),
  session_name            TEXT,
  session_path            TEXT,
  sample_rate             INTEGER,
  bit_depth               INTEGER,
  track_count             INTEGER NOT NULL DEFAULT 0,
  tracks                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  playlists               JSONB NOT NULL DEFAULT '[]'::jsonb,
  routing                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  bounce_sources          JSONB NOT NULL DEFAULT '[]'::jsonb,
  plugin_inventory        JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_ptsl_snapshots_session_created
  ON protools_session_snapshots (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ptsl_snapshots_version
  ON protools_session_snapshots (review_version_id) WHERE review_version_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS protools_delivery_jobs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID NOT NULL REFERENCES protools_companion_sessions(id) ON DELETE CASCADE,
  user_id                 VARCHAR(64) NOT NULL,
  audio_review_project_id UUID REFERENCES audio_review_projects(id) ON DELETE SET NULL,
  manifest_id             UUID REFERENCES audio_delivery_manifests(id) ON DELETE SET NULL,
  preset                  VARCHAR(48) NOT NULL,
  requested_outputs       JSONB NOT NULL DEFAULT '[]'::jsonb,
  status                  VARCHAR(24) NOT NULL DEFAULT 'queued'
                          CHECK (status IN ('queued','running','completed','failed','cancelled')),
  progress                INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  output_files            JSONB NOT NULL DEFAULT '[]'::jsonb,
  qc_reports              JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_error              TEXT,
  started_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ptsl_delivery_jobs_session_created
  ON protools_delivery_jobs (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ptsl_delivery_jobs_active
  ON protools_delivery_jobs (status, updated_at) WHERE status IN ('queued','running');

ALTER TABLE protools_companion_bounces
  ADD COLUMN IF NOT EXISTS snapshot_id UUID REFERENCES protools_session_snapshots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_job_id UUID REFERENCES protools_delivery_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_kind VARCHAR(48),
  ADD COLUMN IF NOT EXISTS qc_report JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ptsl_bounces_delivery_job
  ON protools_companion_bounces (delivery_job_id) WHERE delivery_job_id IS NOT NULL;
