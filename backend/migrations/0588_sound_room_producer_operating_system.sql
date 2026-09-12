-- 0588_sound_room_producer_operating_system.sql
--
-- Sound Room Producer OS: durable producer inbox, listening receipts,
-- revision briefs, blind multi-version decisions, album/EP sequencing,
-- role-based sign-off and immutable delivery manifests.

CREATE TABLE IF NOT EXISTS audio_review_project_settings (
  project_id             UUID PRIMARY KEY REFERENCES audio_review_projects(id) ON DELETE CASCADE,
  comparison_mode        TEXT NOT NULL DEFAULT 'level_matched'
                         CHECK (comparison_mode IN ('original', 'level_matched')),
  approval_policy        JSONB NOT NULL DEFAULT '{"stages":["mix","master","delivery"]}'::jsonb,
  notification_settings  JSONB NOT NULL DEFAULT '{"newVersion":true,"newComment":true,"decisionClosed":true,"approvalRequested":true}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audio_review_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES audio_review_projects(id) ON DELETE CASCADE,
  actor_id    TEXT,
  actor_name  TEXT,
  event_type  TEXT NOT NULL CHECK (event_type IN (
    'version_uploaded', 'comment_added', 'comment_resolved', 'task_changed',
    'decision_started', 'decision_voted', 'decision_closed', 'version_listened',
    'approval_requested', 'approval_signed', 'brief_generated',
    'collection_changed', 'delivery_created'
  )),
  summary     TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audio_review_activity_project_created
  ON audio_review_activity (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audio_review_activity_unread
  ON audio_review_activity (project_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS audio_review_listens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES audio_review_projects(id) ON DELETE CASCADE,
  version_id        UUID NOT NULL REFERENCES audio_review_versions(id) ON DELETE CASCADE,
  member_id         UUID REFERENCES audio_review_members(id) ON DELETE SET NULL,
  listener_key      TEXT NOT NULL,
  listened_seconds  DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (listened_seconds >= 0),
  completion_ratio  DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (completion_ratio >= 0 AND completion_ratio <= 1),
  first_listened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_listened_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  UNIQUE (version_id, listener_key)
);
CREATE INDEX IF NOT EXISTS idx_audio_review_listens_project
  ON audio_review_listens (project_id, last_listened_at DESC);

CREATE TABLE IF NOT EXISTS audio_revision_briefs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES audio_review_projects(id) ON DELETE CASCADE,
  source_version_id  UUID REFERENCES audio_review_versions(id) ON DELETE SET NULL,
  title              TEXT NOT NULL,
  summary            TEXT NOT NULL,
  priorities         JSONB NOT NULL DEFAULT '[]'::jsonb,
  conflicts          JSONB NOT NULL DEFAULT '[]'::jsonb,
  resolved_count     INTEGER NOT NULL DEFAULT 0 CHECK (resolved_count >= 0),
  unresolved_count   INTEGER NOT NULL DEFAULT 0 CHECK (unresolved_count >= 0),
  generation_mode    TEXT NOT NULL DEFAULT 'deterministic'
                     CHECK (generation_mode IN ('ai', 'deterministic')),
  created_by         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audio_revision_briefs_project
  ON audio_revision_briefs (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audio_decision_rooms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES audio_review_projects(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  prompt              TEXT,
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  blind                BOOLEAN NOT NULL DEFAULT TRUE,
  level_matched        BOOLEAN NOT NULL DEFAULT TRUE,
  allow_multiple       BOOLEAN NOT NULL DEFAULT FALSE,
  closes_at            TIMESTAMPTZ,
  winner_version_id    UUID REFERENCES audio_review_versions(id) ON DELETE SET NULL,
  created_by           TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_audio_decision_rooms_project
  ON audio_decision_rooms (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audio_decision_candidates (
  decision_id  UUID NOT NULL REFERENCES audio_decision_rooms(id) ON DELETE CASCADE,
  version_id   UUID NOT NULL REFERENCES audio_review_versions(id) ON DELETE CASCADE,
  label        TEXT,
  order_index  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (decision_id, version_id)
);

CREATE TABLE IF NOT EXISTS audio_decision_votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id   UUID NOT NULL REFERENCES audio_decision_rooms(id) ON DELETE CASCADE,
  version_id    UUID NOT NULL REFERENCES audio_review_versions(id) ON DELETE CASCADE,
  voter_key     TEXT NOT NULL,
  voter_name    TEXT,
  rationale     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (decision_id, voter_key)
);
CREATE INDEX IF NOT EXISTS idx_audio_decision_votes_decision
  ON audio_decision_votes (decision_id, created_at ASC);

CREATE TABLE IF NOT EXISTS audio_project_collections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  TEXT NOT NULL,
  title          TEXT NOT NULL,
  artist_name    TEXT,
  collection_type TEXT NOT NULL DEFAULT 'album' CHECK (collection_type IN ('ep', 'album')),
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sequencing', 'approved', 'delivered')),
  target_date    DATE,
  cover_url      TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audio_project_collections_owner
  ON audio_project_collections (owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS audio_project_collection_items (
  collection_id  UUID NOT NULL REFERENCES audio_project_collections(id) ON DELETE CASCADE,
  project_id     UUID NOT NULL REFERENCES audio_review_projects(id) ON DELETE CASCADE,
  track_number   INTEGER NOT NULL CHECK (track_number > 0),
  disc_number    INTEGER NOT NULL DEFAULT 1 CHECK (disc_number > 0),
  transition_note TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, project_id),
  UNIQUE (collection_id, disc_number, track_number)
);

ALTER TABLE audio_review_members
  ADD COLUMN IF NOT EXISTS can_approve BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS audio_review_signoffs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES audio_review_projects(id) ON DELETE CASCADE,
  version_id    UUID NOT NULL REFERENCES audio_review_versions(id) ON DELETE CASCADE,
  member_id     UUID REFERENCES audio_review_members(id) ON DELETE CASCADE,
  stage         TEXT NOT NULL CHECK (stage IN ('mix', 'master', 'delivery')),
  status        TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'changes_requested', 'revoked')),
  requested_by  TEXT NOT NULL,
  response_note TEXT,
  responded_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, version_id, member_id, stage)
);
CREATE INDEX IF NOT EXISTS idx_audio_review_signoffs_project
  ON audio_review_signoffs (project_id, stage, status);

CREATE TABLE IF NOT EXISTS audio_delivery_manifests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES audio_review_projects(id) ON DELETE CASCADE,
  collection_id      UUID REFERENCES audio_project_collections(id) ON DELETE SET NULL,
  manifest_number    INTEGER NOT NULL,
  title              TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('draft', 'ready', 'delivered', 'revoked')),
  checksum_algorithm TEXT NOT NULL DEFAULT 'sha256-metadata',
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at       TIMESTAMPTZ,
  UNIQUE (project_id, manifest_number)
);
CREATE INDEX IF NOT EXISTS idx_audio_delivery_manifests_project
  ON audio_delivery_manifests (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audio_delivery_manifest_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id    UUID NOT NULL REFERENCES audio_delivery_manifests(id) ON DELETE CASCADE,
  deliverable_id UUID REFERENCES audio_review_deliverables(id) ON DELETE SET NULL,
  version_id     UUID REFERENCES audio_review_versions(id) ON DELETE SET NULL,
  file_name      TEXT NOT NULL,
  file_url       TEXT NOT NULL,
  format         TEXT,
  file_size      BIGINT,
  checksum       TEXT,
  order_index    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_audio_delivery_manifest_items_manifest
  ON audio_delivery_manifest_items (manifest_id, order_index ASC);

ALTER TABLE audio_review_comments
  ADD COLUMN IF NOT EXISTS voice_note_url TEXT,
  ADD COLUMN IF NOT EXISTS voice_note_duration DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS voice_note_mime_type TEXT;
