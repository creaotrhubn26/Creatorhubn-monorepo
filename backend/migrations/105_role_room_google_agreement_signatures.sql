BEGIN;

CREATE TABLE IF NOT EXISTS role_room_google_agreement_signatures (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  agreement_id VARCHAR(255) NOT NULL,
  provider VARCHAR(64) NOT NULL DEFAULT 'google_workspace',
  status VARCHAR(64) NOT NULL DEFAULT 'not_started',
  document_title TEXT,
  drive_source_file_id VARCHAR(255),
  signed_drive_file_id VARCHAR(255),
  audit_artifact_id VARCHAR(255),
  request_url TEXT,
  web_view_url TEXT,
  requested_by VARCHAR(255),
  requested_by_email VARCHAR(255),
  counterparty_name TEXT,
  counterparty_email VARCHAR(255),
  prepared_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  signature_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_agreement_signature_unique
  ON role_room_google_agreement_signatures(project_id, agreement_id);
CREATE INDEX IF NOT EXISTS idx_rr_google_agreement_signatures_project
  ON role_room_google_agreement_signatures(project_id);
CREATE INDEX IF NOT EXISTS idx_rr_google_agreement_signatures_status
  ON role_room_google_agreement_signatures(status);
CREATE INDEX IF NOT EXISTS idx_rr_google_agreement_signatures_drive_source
  ON role_room_google_agreement_signatures(drive_source_file_id);
CREATE INDEX IF NOT EXISTS idx_rr_google_agreement_signatures_signed_drive
  ON role_room_google_agreement_signatures(signed_drive_file_id);

COMMIT;
