-- 0554_leadgrid_discovery_campaign_runs.sql
--
-- Persistent, project-scoped orchestration for an ordered set of Discovery
-- profiles. A campaign owns exactly one active child run pointer at a time;
-- deterministic per-item attempts make worker and network retries replay-safe.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS leadgrid_discovery_campaign_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  name VARCHAR(120) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued', 'running', 'completed', 'partial', 'failed',
      'cancel_requested', 'cancelled'
    )),
  profile_ids UUID[] NOT NULL,
  current_position SMALLINT NOT NULL DEFAULT 0,
  active_run_id UUID,
  idempotency_key VARCHAR(255) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  requested_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  cancellation_requested_at TIMESTAMPTZ,
  cancellation_requested_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_code VARCHAR(80),
  error_message TEXT,
  poll_generation BIGINT NOT NULL DEFAULT 0 CHECK (poll_generation >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leadgrid_discovery_campaign_runs_profiles_check
    CHECK (cardinality(profile_ids) BETWEEN 1 AND 10),
  CONSTRAINT leadgrid_discovery_campaign_runs_position_check
    CHECK (current_position BETWEEN 0 AND cardinality(profile_ids)),
  CONSTRAINT leadgrid_discovery_campaign_runs_hash_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT leadgrid_discovery_campaign_runs_project_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_discovery_campaign_runs_scope_id_key
    UNIQUE (organization_id, project_id, id),
  CONSTRAINT leadgrid_discovery_campaign_runs_active_run_fk
    FOREIGN KEY (organization_id, project_id, active_run_id)
    REFERENCES leadgrid_discovery_runs(organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_leadgrid_discovery_campaign_runs_idempotency
  ON leadgrid_discovery_campaign_runs
  (organization_id, project_id, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS ux_leadgrid_discovery_campaign_runs_one_active
  ON leadgrid_discovery_campaign_runs (organization_id, project_id)
  WHERE status IN ('queued', 'running', 'cancel_requested');

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_campaign_runs_history
  ON leadgrid_discovery_campaign_runs
  (organization_id, project_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS leadgrid_discovery_campaign_items (
  campaign_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  position SMALLINT NOT NULL CHECK (position >= 0),
  profile_id UUID NOT NULL,
  profile_version INTEGER NOT NULL CHECK (profile_version > 0),
  profile_name VARCHAR(120) NOT NULL,
  territory_code VARCHAR(48),
  brief_snapshot JSONB NOT NULL CHECK (jsonb_typeof(brief_snapshot) = 'object'),
  source_cursor_map_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(source_cursor_map_snapshot) = 'object'),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'launching', 'queued', 'running',
      'completed', 'partial', 'failed', 'cancelled'
    )),
  attempt_count SMALLINT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  current_run_id UUID,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_code VARCHAR(80),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, position),
  CONSTRAINT leadgrid_discovery_campaign_items_scope_key
    UNIQUE (organization_id, project_id, campaign_id, position),
  CONSTRAINT leadgrid_discovery_campaign_items_profile_once
    UNIQUE (campaign_id, profile_id),
  CONSTRAINT leadgrid_discovery_campaign_items_campaign_fk
    FOREIGN KEY (organization_id, project_id, campaign_id)
    REFERENCES leadgrid_discovery_campaign_runs(organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_discovery_campaign_items_profile_fk
    FOREIGN KEY (organization_id, project_id, profile_id)
    REFERENCES leadgrid_discovery_profiles(organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT leadgrid_discovery_campaign_items_run_fk
    FOREIGN KEY (organization_id, project_id, current_run_id)
    REFERENCES leadgrid_discovery_runs(organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_campaign_items_campaign
  ON leadgrid_discovery_campaign_items
  (organization_id, project_id, campaign_id, position);

CREATE TABLE IF NOT EXISTS leadgrid_discovery_campaign_attempts (
  campaign_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  position SMALLINT NOT NULL,
  attempt_no SMALLINT NOT NULL CHECK (attempt_no > 0),
  run_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, position, attempt_no),
  CONSTRAINT leadgrid_discovery_campaign_attempts_run_key UNIQUE (run_id),
  CONSTRAINT leadgrid_discovery_campaign_attempts_item_fk
    FOREIGN KEY (organization_id, project_id, campaign_id, position)
    REFERENCES leadgrid_discovery_campaign_items(
      organization_id, project_id, campaign_id, position
    ) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_discovery_campaign_attempts_run_fk
    FOREIGN KEY (organization_id, project_id, run_id)
    REFERENCES leadgrid_discovery_runs(organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS leadgrid_discovery_campaign_commands (
  organization_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  campaign_id UUID NOT NULL,
  command VARCHAR(16) NOT NULL CHECK (command IN ('advance', 'retry', 'cancel')),
  idempotency_key VARCHAR(255) NOT NULL,
  request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  requested_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (
    organization_id, project_id, campaign_id, command, idempotency_key
  ),
  CONSTRAINT leadgrid_discovery_campaign_commands_campaign_fk
    FOREIGN KEY (organization_id, project_id, campaign_id)
    REFERENCES leadgrid_discovery_campaign_runs(organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

COMMENT ON TABLE leadgrid_discovery_campaign_runs IS
  'Ordered project-scoped Discovery profile campaigns with one durable active child-run pointer.';
COMMENT ON TABLE leadgrid_discovery_campaign_attempts IS
  'Immutable history linking every campaign item attempt to its Discovery run.';

COMMIT;
