-- 263_audio_showcase.sql
--
-- Audio Showcase MVP-datamodell (jf. spec §10/§29/§30). Et profesjonelt
-- review-rom for mix/master: prosjekt → versjoner (bounces) → tidskodede
-- kommentarer + seksjoner + godkjenninger + leveranser.
--
-- Waveform genereres frontend (wavesurfer, spec §3 Alt A) i MVP — ingen
-- FFmpeg-pipeline ennå. Tabellene har felt for backend-peaks (waveform_*)
-- klar til V2.

CREATE TABLE IF NOT EXISTS audio_review_projects (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT        NOT NULL,
  showcase_id   TEXT,
  title         TEXT        NOT NULL,
  artist_name   TEXT,
  band_name     TEXT,
  genre         TEXT,
  bpm           INTEGER,
  musical_key   TEXT,
  -- draft | under_review | changes_requested | approved | final_delivered | archived
  status        TEXT        NOT NULL DEFAULT 'draft',
  deadline      DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audio_projects_owner ON audio_review_projects (owner_user_id);

CREATE TABLE IF NOT EXISTS audio_review_versions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES audio_review_projects(id) ON DELETE CASCADE,
  version_label   TEXT        NOT NULL,
  version_number  INTEGER     NOT NULL DEFAULT 1,
  file_name       TEXT,
  file_url        TEXT        NOT NULL,
  preview_url     TEXT,
  waveform_json_url  TEXT,
  duration        DOUBLE PRECISION,
  sample_rate     INTEGER,
  bit_depth       INTEGER,
  channels        INTEGER,
  codec           TEXT,
  file_size       BIGINT,
  -- under_review | superseded | approved | locked
  status          TEXT        NOT NULL DEFAULT 'under_review',
  uploaded_by     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audio_versions_project ON audio_review_versions (project_id);

CREATE TABLE IF NOT EXISTS audio_review_comments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id        UUID        NOT NULL REFERENCES audio_review_versions(id) ON DELETE CASCADE,
  parent_comment_id UUID,
  user_id           TEXT,
  author            TEXT,
  timecode_seconds  DOUBLE PRECISION NOT NULL DEFAULT 0,
  body              TEXT        NOT NULL,
  category          TEXT        DEFAULT 'general',
  -- unresolved | in_progress | resolved | decision | rejected
  status            TEXT        NOT NULL DEFAULT 'unresolved',
  is_decision       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audio_comments_version ON audio_review_comments (version_id);

CREATE TABLE IF NOT EXISTS audio_review_sections (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id         UUID        NOT NULL REFERENCES audio_review_versions(id) ON DELETE CASCADE,
  name               TEXT        NOT NULL,
  start_time_seconds DOUBLE PRECISION NOT NULL,
  end_time_seconds   DOUBLE PRECISION NOT NULL,
  color              TEXT,
  order_index        INTEGER     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_audio_sections_version ON audio_review_sections (version_id);

CREATE TABLE IF NOT EXISTS audio_review_approvals (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id    UUID        NOT NULL REFERENCES audio_review_versions(id) ON DELETE CASCADE,
  approved_by   TEXT,
  -- mix_approved | master_approved | delivery_approved | changes_requested
  approval_type TEXT        NOT NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audio_review_deliverables (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID        NOT NULL REFERENCES audio_review_projects(id) ON DELETE CASCADE,
  version_id   UUID,
  type         TEXT,
  file_name    TEXT,
  file_url     TEXT,
  file_size    BIGINT,
  format       TEXT,
  downloadable BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audio_deliverables_project ON audio_review_deliverables (project_id);
