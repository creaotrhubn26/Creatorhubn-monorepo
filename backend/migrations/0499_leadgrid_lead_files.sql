-- Team-visible Leadgrid attachments backed by the existing encrypted B2 file store.
-- The association is organization-scoped; the binary remains quota-accounted to
-- the uploader in role_room_user_files.

BEGIN;

CREATE TABLE IF NOT EXISTS leadgrid_lead_files (
  file_id UUID PRIMARY KEY REFERENCES role_room_user_files(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  uploader_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  description TEXT CHECK (description IS NULL OR length(description) <= 2000),
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_lead_files_feed
  ON leadgrid_lead_files (organization_id, lead_id, created_at DESC);

COMMIT;
