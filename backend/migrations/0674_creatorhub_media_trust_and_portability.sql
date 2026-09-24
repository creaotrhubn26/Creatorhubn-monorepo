-- CreatorHub media trust and portability.
--
-- A stopped CreatorHub subscription enters a 30-day download-only window.
-- The window NEVER schedules deletion: media stays retained and can be
-- unlocked by restoring the subscription.  Events and export receipts are
-- append-only so both the studio and support can prove what happened.

BEGIN;

CREATE TABLE IF NOT EXISTS creatorhub_media_access_windows (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state varchar(20) NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'download_only')),
  reason varchar(40),
  download_only_started_at timestamptz,
  download_only_until timestamptz,
  restored_at timestamptz,
  source varchar(40),
  source_reference varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creatorhub_media_access_window_dates_check CHECK (
    state = 'active'
    OR (
      download_only_started_at IS NOT NULL
      AND download_only_until IS NOT NULL
      AND download_only_until > download_only_started_at
    )
  )
);

CREATE INDEX IF NOT EXISTS creatorhub_media_access_download_deadline_idx
  ON creatorhub_media_access_windows(download_only_until)
  WHERE state = 'download_only';

CREATE TABLE IF NOT EXISTS creatorhub_media_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type varchar(32) NOT NULL
    CHECK (event_type IN ('download_window_started', 'access_restored')),
  reason varchar(40),
  source varchar(40),
  source_reference varchar(255),
  effective_at timestamptz NOT NULL,
  download_only_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS creatorhub_media_access_events_source_idx
  ON creatorhub_media_access_events(user_id, event_type, source, source_reference)
  WHERE source_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS creatorhub_media_access_events_user_idx
  ON creatorhub_media_access_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS creatorhub_media_export_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id varchar NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requested_by varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  manifest_sha256 char(64) NOT NULL
    CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  item_count integer NOT NULL CHECK (item_count >= 0),
  total_bytes bigint NOT NULL CHECK (total_bytes >= 0),
  verified_checksum_count integer NOT NULL DEFAULT 0
    CHECK (verified_checksum_count >= 0),
  media_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  access_state varchar(20) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creatorhub_media_export_receipts_project_idx
  ON creatorhub_media_export_receipts(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creatorhub_media_export_receipts_user_idx
  ON creatorhub_media_export_receipts(user_id, created_at DESC);

COMMENT ON TABLE creatorhub_media_access_windows IS
  'CreatorHub media access state. download_only lasts 30 days; expiry locks downloads but never deletes media.';
COMMENT ON TABLE creatorhub_media_export_receipts IS
  'Immutable evidence for a generated cross-room media portability manifest.';

COMMIT;
