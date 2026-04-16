-- 0043_role_room_ai_governance.sql
-- GDPR governance tables for The Role Room Agent.
-- See docs/role-room/ai-gdpr-dpia.md for why each column exists.

-- =============================================================================
-- role_room_ai_consent
--   Art. 6.1a / Art. 7.1 consent evidence. Every AI call MUST be gated on an
--   active row in this table. Deleting a row (or setting revoked_at) is
--   equivalent to withdrawing consent.
-- =============================================================================
CREATE TABLE IF NOT EXISTS role_room_ai_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- 'brief_only' | 'brief_and_reviews' | 'full_context'
  scope TEXT NOT NULL CHECK (scope IN ('brief_only', 'brief_and_reviews', 'full_context')),

  -- Which upstream AI processor the consent applies to. Consent is
  -- processor-specific so migrating Cohere → Claude requires re-consent.
  processor TEXT NOT NULL CHECK (processor IN ('cohere', 'anthropic')),

  note TEXT,

  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,

  -- Entity-level granularity — JSON arrays of candidate/crew IDs.
  -- Excluded wins over included when both contain the same id.
  excluded_entity_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  included_entity_ids JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS role_room_ai_consent_project_processor_idx
  ON role_room_ai_consent (project_id, processor)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS role_room_ai_consent_user_idx
  ON role_room_ai_consent (user_id, granted_at DESC);

-- =============================================================================
-- role_room_ai_audit_log
--   Art. 30 / Art. 32 audit trail. NEVER store prompt content here — PII safety
--   would be compromised. Only metadata: tokens, model, field categories.
--   12-month retention enforced by cron (see seven-day scheduler in backend).
-- =============================================================================
CREATE TABLE IF NOT EXISTS role_room_ai_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  consent_id UUID REFERENCES role_room_ai_consent(id) ON DELETE SET NULL,

  processor TEXT NOT NULL CHECK (processor IN ('cohere', 'anthropic')),
  model TEXT NOT NULL,

  action TEXT NOT NULL,            -- e.g. 'bootstrap', 'rerank', 'summarize_brief', 'scope_analysis'
  status TEXT NOT NULL CHECK (status IN ('ok', 'error', 'blocked_by_consent', 'blocked_by_rate_limit')),

  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  latency_ms INTEGER,

  -- Ordered category list of PII types sent this call (never raw values).
  -- Example: ["candidate_name_pseudo", "candidate_email_pseudo", "brief_fields"]
  field_categories JSONB NOT NULL DEFAULT '[]'::jsonb,

  entity_count INTEGER NOT NULL DEFAULT 0,
  emails_scrubbed INTEGER NOT NULL DEFAULT 0,
  phones_scrubbed INTEGER NOT NULL DEFAULT 0,

  error_code TEXT,
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_ai_audit_log_project_idx
  ON role_room_ai_audit_log (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS role_room_ai_audit_log_user_idx
  ON role_room_ai_audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS role_room_ai_audit_log_status_idx
  ON role_room_ai_audit_log (status, created_at DESC);

-- =============================================================================
-- Retention: delete audit rows older than 365 days on a nightly job.
-- The cronjob itself lives in application code; this is the canonical query.
-- =============================================================================
COMMENT ON TABLE role_room_ai_audit_log IS
  'GDPR Art. 30 audit log. Retention: 365 days. Cron: nightly DELETE WHERE created_at < now() - interval ''365 days''.';

COMMENT ON TABLE role_room_ai_consent IS
  'GDPR Art. 6.1a / Art. 7 consent evidence. Single active row per (project_id, processor) via partial unique index.';
