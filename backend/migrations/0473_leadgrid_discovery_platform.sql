-- 0473_leadgrid_discovery_platform.sql
--
-- Durable, tenant-safe persistence for Leadgrid Discovery.
--
-- This is an additive/expand-only migration. The legacy
-- leadgrid_project_discovery_config and leadgrid_url_research_* tables stay in
-- place while native and web clients move to the new contract. In particular,
-- candidates live outside crm_customers until a user explicitly approves them.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Fencing for the shared PostgreSQL worker queue. Each claim rotates this
-- token; stale workers may no longer heartbeat or finalize after reclaim.
ALTER TABLE background_jobs
  ADD COLUMN IF NOT EXISTS lease_token UUID;

COMMENT ON COLUMN background_jobs.lease_token IS
  'Per-claim fencing token. Heartbeat/finalization must CAS id + running status + token.';

-- Shared, hashed, single-use credentials for /ws/leadgrid. A ticket is
-- issued only over an authenticated HTTPS request and can be consumed by any
-- backend instance, so WebSocket upgrades do not require pod affinity.
CREATE TABLE IF NOT EXISTS leadgrid_realtime_tickets (
  ticket_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_realtime_tickets_user_issued
  ON leadgrid_realtime_tickets (user_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_leadgrid_realtime_tickets_expires
  ON leadgrid_realtime_tickets (expires_at);

-- A composite project key lets every Discovery child enforce that its
-- organization and project agree. The primary key already makes id unique, so
-- this constraint cannot reject a previously valid project row.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'leadgrid_projects'::regclass
       AND conname = 'leadgrid_projects_organization_id_id_key'
  ) THEN
    ALTER TABLE leadgrid_projects
      ADD CONSTRAINT leadgrid_projects_organization_id_id_key
      UNIQUE (organization_id, id);
  END IF;
END
$migration$;

-- Named ICP/target profiles. Multiple profiles may coexist for one project,
-- while a partial unique index below keeps at most one active default.
CREATE TABLE IF NOT EXISTS leadgrid_discovery_profiles (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            UUID NOT NULL
                             REFERENCES organizations(id) ON DELETE CASCADE,
  project_id                  TEXT NOT NULL,
  name                        VARCHAR(120) NOT NULL DEFAULT 'Standard',
  is_default                  BOOLEAN NOT NULL DEFAULT FALSE,
  status                      VARCHAR(16) NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'paused', 'archived')),

  -- Stable, queryable parts of the Discovery brief.
  target_customer_types       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  city_filters                TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  geography_lat               NUMERIC(9, 6),
  geography_lng               NUMERIC(9, 6),
  geography_radius_km         INTEGER NOT NULL DEFAULT 25
                              CHECK (geography_radius_km BETWEEN 1 AND 50),
  company_size_min            INTEGER CHECK (company_size_min IS NULL OR company_size_min >= 0),
  company_size_max            INTEGER CHECK (company_size_max IS NULL OR company_size_max >= 0),
  brief                       JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(brief) = 'object'),
  desired_signals             JSONB NOT NULL DEFAULT '[]'::jsonb
                              CHECK (jsonb_typeof(desired_signals) = 'array'),
  exclusion_rules             JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(exclusion_rules) = 'object'),
  source_config               JSONB NOT NULL DEFAULT
                              '{
                                "brreg_open_data":{"enabled":true},
                                "google_places":{
                                  "enabled":false,
                                  "mode":"transient_details_only"
                                }
                              }'::jsonb
                              CHECK (jsonb_typeof(source_config) = 'object'),
  scoring_weights             JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(scoring_weights) = 'object'),

  -- Approval is manual-only until a separately reviewed rules engine ships.
  -- approval_rules is reserved storage and is neither exposed nor operative.
  approval_mode               VARCHAR(16) NOT NULL DEFAULT 'manual'
                              CHECK (approval_mode = 'manual'),
  approval_rules              JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(approval_rules) = 'object'),
  max_candidates_per_run      SMALLINT NOT NULL DEFAULT 20
                              CHECK (max_candidates_per_run BETWEEN 1 AND 60),
  enrichment_count            SMALLINT NOT NULL DEFAULT 10
                              CHECK (enrichment_count BETWEEN 1 AND 60),
  monthly_candidate_budget    INTEGER
                              CHECK (monthly_candidate_budget IS NULL OR monthly_candidate_budget > 0),

  -- Durable schedule state; the scheduler must claim due rows with
  -- FOR UPDATE SKIP LOCKED and use a deterministic run idempotency key.
  auto_discover_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  schedule_cron               VARCHAR(120) NOT NULL DEFAULT '0 6 * * *',
  schedule_timezone           VARCHAR(80) NOT NULL DEFAULT 'Europe/Oslo',
  rotation_index              INTEGER NOT NULL DEFAULT 0 CHECK (rotation_index >= 0),
  last_run_at                 TIMESTAMPTZ,
  next_run_at                 TIMESTAMPTZ,

  -- Reserved for a future reviewed learning contract. These fields are not
  -- exposed or treated as operative by the current public profile API.
  learning_summary            JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(learning_summary) = 'object'),
  pending_suggestions         JSONB NOT NULL DEFAULT '[]'::jsonb
                              CHECK (jsonb_typeof(pending_suggestions) = 'array'),
  last_learning_at            TIMESTAMPTZ,

  version                     INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by                  VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  updated_by                  VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leadgrid_discovery_profiles_geo_pair_check CHECK (
    (geography_lat IS NULL AND geography_lng IS NULL)
    OR (
      geography_lat BETWEEN -90 AND 90
      AND geography_lng BETWEEN -180 AND 180
    )
  ),
  CONSTRAINT leadgrid_discovery_profiles_company_size_check CHECK (
    company_size_min IS NULL
    OR company_size_max IS NULL
    OR company_size_min <= company_size_max
  ),
  CONSTRAINT leadgrid_discovery_profiles_enrichment_target_check CHECK (
    enrichment_count <= max_candidates_per_run
  ),
  CONSTRAINT leadgrid_discovery_profiles_project_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_discovery_profiles_scope_id_key
    UNIQUE (organization_id, project_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_leadgrid_discovery_profiles_default
  ON leadgrid_discovery_profiles (organization_id, project_id)
  WHERE is_default = TRUE AND status <> 'archived';

CREATE UNIQUE INDEX IF NOT EXISTS ux_leadgrid_discovery_profiles_name
  ON leadgrid_discovery_profiles (organization_id, project_id, LOWER(name))
  WHERE status <> 'archived';

-- Auditable, tenant-scoped monthly capacity. Reservations are inserted before
-- enqueue and make retries/idempotency keys consume capacity exactly once.
CREATE TABLE IF NOT EXISTS leadgrid_discovery_monthly_usage (
  organization_id       UUID NOT NULL
                        REFERENCES organizations(id) ON DELETE CASCADE,
  month_start           DATE NOT NULL,
  reserved_candidates   INTEGER NOT NULL DEFAULT 0
                        CHECK (reserved_candidates >= 0),
  run_count             INTEGER NOT NULL DEFAULT 0 CHECK (run_count >= 0),
  candidate_limit       INTEGER NOT NULL CHECK (candidate_limit > 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, month_start),
  CHECK (date_trunc('month', month_start::timestamp)::date = month_start)
);

CREATE TABLE IF NOT EXISTS leadgrid_discovery_capacity_reservations (
  organization_id       UUID NOT NULL,
  idempotency_key       VARCHAR(255) NOT NULL,
  month_start           DATE NOT NULL,
  reserved_candidates   SMALLINT NOT NULL
                        CHECK (reserved_candidates BETWEEN 1 AND 60),
  run_id                UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, idempotency_key),
  FOREIGN KEY (organization_id, month_start)
    REFERENCES leadgrid_discovery_monthly_usage(organization_id, month_start)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_capacity_month
  ON leadgrid_discovery_capacity_reservations
  (organization_id, month_start, created_at);

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_profiles_due
  ON leadgrid_discovery_profiles (next_run_at, id)
  WHERE auto_discover_enabled = TRUE AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_profiles_project
  ON leadgrid_discovery_profiles (organization_id, project_id, updated_at DESC);

-- A run is the durable orchestration boundary. It owns idempotency, snapshots,
-- progress, cancellation and links to both the generic queue and legacy batch.
CREATE TABLE IF NOT EXISTS leadgrid_discovery_runs (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            UUID NOT NULL
                             REFERENCES organizations(id) ON DELETE CASCADE,
  project_id                  TEXT NOT NULL,
  profile_id                  UUID,
  profile_version             INTEGER CHECK (profile_version IS NULL OR profile_version > 0),
  trigger_kind                VARCHAR(20) NOT NULL
                              CHECK (trigger_kind IN ('manual', 'scheduled', 'workflow', 'api', 'retry')),
  status                      VARCHAR(28) NOT NULL DEFAULT 'planning'
                              CHECK (status IN (
                                'planning', 'awaiting_confirmation', 'queued',
                                'searching', 'researching', 'review_ready',
                                'completed', 'partial', 'cancel_requested',
                                'cancelled', 'failed'
                              )),
  requested_by                VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  requested_count             SMALLINT NOT NULL DEFAULT 20
                              CHECK (requested_count BETWEEN 1 AND 60),
  enrichment_count            SMALLINT NOT NULL DEFAULT 10
                              CHECK (enrichment_count BETWEEN 1 AND 60),
  scheduled_for               TIMESTAMPTZ,

  -- Durable request idempotency: the API compares request_hash before replay.
  idempotency_key             VARCHAR(255) NOT NULL,
  request_hash                CHAR(64) NOT NULL
                              CHECK (request_hash ~ '^[0-9a-f]{64}$'),

  brief_snapshot              JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(brief_snapshot) = 'object'),
  search_plan                 JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(search_plan) = 'object'),
  checkpoint                  JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(checkpoint) = 'object'),
  source_summary              JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(source_summary) = 'object'),
  provider_usage              JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(provider_usage) = 'object'),

  raw_result_count            INTEGER NOT NULL DEFAULT 0 CHECK (raw_result_count >= 0),
  duplicate_count             INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  excluded_count              INTEGER NOT NULL DEFAULT 0 CHECK (excluded_count >= 0),
  candidate_count             INTEGER NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
  researched_count            INTEGER NOT NULL DEFAULT 0 CHECK (researched_count >= 0),
  review_ready_count          INTEGER NOT NULL DEFAULT 0 CHECK (review_ready_count >= 0),
  approved_count              INTEGER NOT NULL DEFAULT 0 CHECK (approved_count >= 0),
  rejected_count              INTEGER NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  imported_count              INTEGER NOT NULL DEFAULT 0 CHECK (imported_count >= 0),
  failed_count                INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),

  background_job_id           UUID REFERENCES background_jobs(id) ON DELETE SET NULL,
  execution_lease_token       UUID,
  legacy_batch_id             UUID REFERENCES leadgrid_url_research_batches(id) ON DELETE SET NULL,
  error_code                  VARCHAR(80),
  error_message               TEXT,
  cancellation_requested_at   TIMESTAMPTZ,
  started_at                  TIMESTAMPTZ,
  finished_at                 TIMESTAMPTZ,
  version                     INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leadgrid_discovery_runs_enrichment_target_check CHECK (
    enrichment_count <= requested_count
  ),
  CONSTRAINT leadgrid_discovery_runs_project_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_discovery_runs_profile_fkey
    FOREIGN KEY (organization_id, project_id, profile_id)
    REFERENCES leadgrid_discovery_profiles(organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_discovery_runs_scope_id_key
    UNIQUE (organization_id, project_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_leadgrid_discovery_runs_idempotency
  ON leadgrid_discovery_runs (organization_id, project_id, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS ux_leadgrid_discovery_runs_background_job
  ON leadgrid_discovery_runs (background_job_id)
  WHERE background_job_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_leadgrid_discovery_runs_legacy_batch
  ON leadgrid_discovery_runs (legacy_batch_id)
  WHERE legacy_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_runs_project_history
  ON leadgrid_discovery_runs (organization_id, project_id, created_at DESC, id DESC);

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'leadgrid_discovery_capacity_reservations'::regclass
       AND conname = 'leadgrid_discovery_capacity_reservations_run_fkey'
  ) THEN
    ALTER TABLE leadgrid_discovery_capacity_reservations
      ADD CONSTRAINT leadgrid_discovery_capacity_reservations_run_fkey
      FOREIGN KEY (run_id) REFERENCES leadgrid_discovery_runs(id)
      ON DELETE SET NULL;
  END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_runs_active
  ON leadgrid_discovery_runs (organization_id, status, created_at)
  WHERE status IN (
    'planning', 'awaiting_confirmation', 'queued', 'searching',
    'researching', 'cancel_requested'
  );

-- Canonical project-level candidates. One candidate can be observed by many
-- runs, and it is not a crm_customers lead until approval succeeds.
CREATE TABLE IF NOT EXISTS leadgrid_discovery_candidates (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            UUID NOT NULL
                             REFERENCES organizations(id) ON DELETE CASCADE,
  project_id                  TEXT NOT NULL,
  identity_key               VARCHAR(512) NOT NULL,
  status                     VARCHAR(20) NOT NULL DEFAULT 'new'
                              CHECK (status IN (
                                'new', 'review_ready', 'approved', 'rejected',
                                'imported', 'archived', 'failed'
                              )),
  research_status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                              CHECK (research_status IN (
                                'pending', 'queued', 'running', 'completed',
                                'partial', 'failed', 'not_applicable'
                              )),

  name                       TEXT NOT NULL,
  website_url                TEXT,
  phone                      TEXT,
  email                      TEXT,
  address                    TEXT,
  postal_code                VARCHAR(20),
  city                       VARCHAR(120),
  country_code               CHAR(2),
  latitude                   NUMERIC(9, 6),
  longitude                  NUMERIC(9, 6),
  organization_number        VARCHAR(32),
  normalized_domain          VARCHAR(253),
  normalized_phone           VARCHAR(32),

  raw_data                   JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(raw_data) = 'object'),
  enrichment_data            JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(enrichment_data) = 'object'),
  provenance                 JSONB NOT NULL DEFAULT '[]'::jsonb
                              CHECK (jsonb_typeof(provenance) = 'array'),
  data_quality_score         SMALLINT
                              CHECK (data_quality_score IS NULL OR data_quality_score BETWEEN 0 AND 100),
  contactability_score       SMALLINT
                              CHECK (contactability_score IS NULL OR contactability_score BETWEEN 0 AND 100),
  research_error_code        VARCHAR(80),
  research_error_message     TEXT,

  existing_lead_id           UUID REFERENCES crm_customers(id) ON DELETE SET NULL,
  imported_lead_id           UUID REFERENCES crm_customers(id) ON DELETE SET NULL,
  decided_by                 VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  decided_at                 TIMESTAMPTZ,
  imported_at                TIMESTAMPTZ,
  first_seen_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_count                 INTEGER NOT NULL DEFAULT 1 CHECK (seen_count > 0),
  version                    INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by                 VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  updated_by                 VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leadgrid_discovery_candidates_geo_pair_check CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (
      latitude BETWEEN -90 AND 90
      AND longitude BETWEEN -180 AND 180
    )
  ),
  CONSTRAINT leadgrid_discovery_candidates_project_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_discovery_candidates_scope_id_key
    UNIQUE (organization_id, project_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_leadgrid_discovery_candidates_identity
  ON leadgrid_discovery_candidates (organization_id, project_id, identity_key);

-- These are match-candidate indexes rather than uniqueness constraints: one
-- organization may legitimately have branches sharing org number/domain/phone.
CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_candidates_org_number
  ON leadgrid_discovery_candidates (organization_id, project_id, organization_number)
  WHERE organization_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_candidates_domain
  ON leadgrid_discovery_candidates (organization_id, project_id, normalized_domain)
  WHERE normalized_domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_candidates_phone
  ON leadgrid_discovery_candidates (organization_id, project_id, normalized_phone)
  WHERE normalized_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_candidates_inbox
  ON leadgrid_discovery_candidates (
    organization_id, project_id, status, last_seen_at DESC, id DESC
  );

-- Per-run observation and score. ICP scores belong here because the same
-- company may score differently against two profiles in the same project.
CREATE TABLE IF NOT EXISTS leadgrid_discovery_run_candidates (
  organization_id            UUID NOT NULL,
  project_id                  TEXT NOT NULL,
  run_id                      UUID NOT NULL,
  candidate_id                UUID NOT NULL,
  disposition                 VARCHAR(24) NOT NULL DEFAULT 'found'
                              CHECK (disposition IN (
                                'found', 'existing_candidate', 'existing_lead',
                                'excluded', 'research_pending', 'researching',
                                'review_ready', 'approved', 'rejected',
                                'imported', 'duplicate', 'failed'
                              )),
  source_hits                 JSONB NOT NULL DEFAULT '[]'::jsonb
                              CHECK (jsonb_typeof(source_hits) = 'array'),
  matched_on                  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  source_rank                 INTEGER CHECK (source_rank IS NULL OR source_rank > 0),
  fit_score                   SMALLINT CHECK (fit_score IS NULL OR fit_score BETWEEN 0 AND 100),
  fit_coverage                NUMERIC(5, 4) NOT NULL DEFAULT 0
                              CHECK (fit_coverage BETWEEN 0 AND 1),
  data_quality_score          SMALLINT
                              CHECK (data_quality_score IS NULL OR data_quality_score BETWEEN 0 AND 100),
  data_quality_coverage       NUMERIC(5, 4) NOT NULL DEFAULT 0
                              CHECK (data_quality_coverage BETWEEN 0 AND 1),
  excluded                    BOOLEAN NOT NULL DEFAULT FALSE,
  exclusion_matches           JSONB NOT NULL DEFAULT '[]'::jsonb
                              CHECK (jsonb_typeof(exclusion_matches) = 'array'),
  score_model_version         VARCHAR(80),
  score_components            JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(score_components) = 'object'),
  score_explanation           JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(score_explanation) = 'object'),
  evidence                    JSONB NOT NULL DEFAULT '[]'::jsonb
                              CHECK (jsonb_typeof(evidence) = 'array'),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (run_id, candidate_id),
  CONSTRAINT leadgrid_discovery_run_candidates_run_fkey
    FOREIGN KEY (organization_id, project_id, run_id)
    REFERENCES leadgrid_discovery_runs(organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_discovery_run_candidates_candidate_fkey
    FOREIGN KEY (organization_id, project_id, candidate_id)
    REFERENCES leadgrid_discovery_candidates(organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_run_candidates_list
  ON leadgrid_discovery_run_candidates (
    run_id, disposition, fit_score DESC NULLS LAST,
    data_quality_score DESC NULLS LAST, candidate_id
  );

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_run_candidates_history
  ON leadgrid_discovery_run_candidates (candidate_id, created_at DESC, run_id);

-- Append-only feedback/outcome events. The service writes the candidate state,
-- CRM import and corresponding feedback event in one transaction.
CREATE TABLE IF NOT EXISTS leadgrid_discovery_feedback (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            UUID NOT NULL,
  project_id                  TEXT NOT NULL,
  candidate_id                UUID NOT NULL,
  run_id                      UUID,
  lead_id                     UUID REFERENCES crm_customers(id) ON DELETE SET NULL,
  event_type                  VARCHAR(16) NOT NULL
                              CHECK (event_type IN ('decision', 'quality', 'correction', 'outcome')),
  value                       VARCHAR(80) NOT NULL,
  reason_code                 VARCHAR(80),
  rating                      SMALLINT CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  note                        TEXT,
  correction                  JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(correction) = 'object'),
  payload                     JSONB NOT NULL DEFAULT '{}'::jsonb
                              CHECK (jsonb_typeof(payload) = 'object'),
  source                      VARCHAR(16) NOT NULL DEFAULT 'user'
                              CHECK (source IN ('user', 'crm', 'system', 'import')),
  actor_user_id               VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  idempotency_key             VARCHAR(255),
  request_hash                CHAR(64)
                              CHECK (request_hash IS NULL OR request_hash ~ '^[0-9a-f]{64}$'),
  occurred_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leadgrid_discovery_feedback_candidate_fkey
    FOREIGN KEY (organization_id, project_id, candidate_id)
    REFERENCES leadgrid_discovery_candidates(organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_discovery_feedback_run_fkey
    FOREIGN KEY (organization_id, project_id, run_id)
    REFERENCES leadgrid_discovery_runs(organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_leadgrid_discovery_feedback_idempotency
  ON leadgrid_discovery_feedback (
    organization_id, project_id, candidate_id, idempotency_key
  )
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_feedback_candidate
  ON leadgrid_discovery_feedback (candidate_id, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_feedback_learning
  ON leadgrid_discovery_feedback (
    organization_id, project_id, event_type, occurred_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_feedback_lead
  ON leadgrid_discovery_feedback (lead_id, occurred_at DESC)
  WHERE lead_id IS NOT NULL;

-- Small, bounded compatibility backfill: create one default profile for valid
-- org-linked Leadgrid configs. The project's organization is authoritative;
-- org-null/casting/mismatched legacy rows remain available through old tables.
WITH legacy_profiles AS (
  SELECT
    p.organization_id,
    p.id AS project_id,
    CASE
      WHEN COALESCE(cardinality(c.industry_queries), 0) > 0
        THEN c.industry_queries
      WHEN NULLIF(BTRIM(c.industry_query), '') IS NOT NULL
        THEN ARRAY[BTRIM(c.industry_query)]::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END AS target_customer_types,
    COALESCE(c.city_filter, ARRAY[]::TEXT[]) AS city_filters,
    c.geography_lat,
    c.geography_lng,
    LEAST(50, GREATEST(1, COALESCE(c.geography_radius_km, 10)))
      AS geography_radius_km,
    LEAST(60, GREATEST(1, c.count_per_run)) AS target_count,
    c.auto_discover_enabled,
    c.rotation_index,
    c.last_run_at,
    c.next_run_at,
    u.id AS actor_user_id,
    c.created_at,
    c.updated_at
  FROM leadgrid_project_discovery_config c
  JOIN leadgrid_projects p
    ON p.id = c.project_id
   AND p.organization_id IS NOT NULL
  LEFT JOIN users u
    ON u.id = c.created_by_user_id::text
  WHERE p.status IS NULL OR p.status NOT IN ('archived', 'deleted')
)
INSERT INTO leadgrid_discovery_profiles (
  organization_id, project_id, name, is_default, status,
  target_customer_types, city_filters,
  geography_lat, geography_lng, geography_radius_km,
  brief, max_candidates_per_run, enrichment_count,
  auto_discover_enabled, schedule_cron, schedule_timezone,
  rotation_index, last_run_at, next_run_at,
  created_by, updated_by, created_at, updated_at
)
SELECT
  organization_id, project_id, 'Standard', TRUE, 'active',
  target_customer_types, city_filters,
  geography_lat, geography_lng, geography_radius_km,
  jsonb_build_object(
    'migrated_from', 'leadgrid_project_discovery_config',
    'migration_audit', jsonb_build_object(
      'legacy_auto_discover_enabled', auto_discover_enabled,
      'legacy_next_run_at', next_run_at
    ),
    'industry_queries', to_jsonb(target_customer_types),
    'exclusion_terms', '[]'::jsonb,
    'city', CASE
      WHEN COALESCE(cardinality(city_filters), 0) > 0 THEN city_filters[1]
      WHEN geography_lat IS NULL OR geography_lng IS NULL THEN 'Norge'
      ELSE NULL
    END,
    'geo', CASE
      WHEN geography_lat IS NOT NULL AND geography_lng IS NOT NULL
        THEN jsonb_build_object(
          'latitude', geography_lat,
          'longitude', geography_lng,
          'radius_km', geography_radius_km
        )
      ELSE 'null'::jsonb
    END,
    'target_count', target_count,
    'enrichment_count', LEAST(10, target_count),
    'minimum_fit_score', 50,
    'ideal_customer', NULL,
    'goal', NULL
  ),
  target_count, LEAST(10, target_count),
  FALSE, '0 6 * * *', 'Europe/Oslo',
  COALESCE(rotation_index, 0), last_run_at, NULL,
  actor_user_id, actor_user_id, created_at, updated_at
FROM legacy_profiles
ON CONFLICT DO NOTHING;

-- Consistent updated_at behavior; the function is already required by
-- leadgrid_projects (migration 0449).
DROP TRIGGER IF EXISTS update_leadgrid_discovery_profiles_updated_at
  ON leadgrid_discovery_profiles;
CREATE TRIGGER update_leadgrid_discovery_profiles_updated_at
  BEFORE UPDATE ON leadgrid_discovery_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leadgrid_discovery_runs_updated_at
  ON leadgrid_discovery_runs;
CREATE TRIGGER update_leadgrid_discovery_runs_updated_at
  BEFORE UPDATE ON leadgrid_discovery_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leadgrid_discovery_candidates_updated_at
  ON leadgrid_discovery_candidates;
CREATE TRIGGER update_leadgrid_discovery_candidates_updated_at
  BEFORE UPDATE ON leadgrid_discovery_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leadgrid_discovery_run_candidates_updated_at
  ON leadgrid_discovery_run_candidates;
CREATE TRIGGER update_leadgrid_discovery_run_candidates_updated_at
  BEFORE UPDATE ON leadgrid_discovery_run_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE leadgrid_discovery_profiles IS
  'Named, versioned Discovery briefs and explicit continuous-discovery policy.';
COMMENT ON TABLE leadgrid_discovery_runs IS
  'Durable Discovery orchestration, idempotency, progress and cancellation.';
COMMENT ON COLUMN leadgrid_discovery_runs.execution_lease_token IS
  'Current background_jobs lease token; every worker state transition is fenced by it.';
COMMENT ON TABLE leadgrid_discovery_candidates IS
  'Canonical project candidates staged outside CRM until explicit approval.';
COMMENT ON TABLE leadgrid_discovery_run_candidates IS
  'Per-run observations and explainable profile-specific candidate scores.';
COMMENT ON TABLE leadgrid_discovery_feedback IS
  'Append-only human/system decisions, corrections and sales outcomes.';

COMMIT;
