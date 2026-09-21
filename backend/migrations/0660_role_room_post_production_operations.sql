-- Versioned Post Supervisor ledger. Turnover manifests reference existing
-- private Production Sound media IDs/checksums; media bytes remain owned by
-- role_room_storage_objects in the established Role Room S3 bucket.

BEGIN;

CREATE TABLE IF NOT EXISTS role_room_post_production_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL
    REFERENCES casting_projects(id) ON DELETE CASCADE,
  operations JSONB NOT NULL DEFAULT '{"turnovers":[]}'::jsonb,
  version INTEGER NOT NULL DEFAULT 0
    CONSTRAINT chk_role_room_post_production_version CHECK (version >= 0),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_role_room_post_production_project UNIQUE (project_id),
  CONSTRAINT chk_role_room_post_production_payload CHECK (
    jsonb_typeof(operations) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_role_room_post_production_updated
  ON role_room_post_production_operations(project_id, updated_at DESC);

COMMIT;
