-- Client-requested revisions on delivered photos. The gallery "be om endringer"
-- flow writes rows here; the iPad "Revisjoner" inbox reads + resolves them.
-- original_filename is the key the iPad matches against memory cards (across
-- multiple cards) to locate the originals to re-edit.
CREATE TABLE IF NOT EXISTS capture_revision_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        TEXT NOT NULL,
  asset_id          UUID,
  original_filename TEXT NOT NULL,
  client_email      TEXT,
  note              TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'open',   -- open | in_progress | resolved
  source            TEXT NOT NULL DEFAULT 'gallery',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_capture_revision_requests_project_status
  ON capture_revision_requests (project_id, status, created_at DESC);
