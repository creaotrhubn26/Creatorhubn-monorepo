-- =====================================================================
-- 308_client_portal_tokens.sql
--
-- Selv-onboarding + klient-portal-tabeller. Separate BEGIN/COMMIT slik
-- at en feil i én tabell ikke ruller back de andre.
-- =====================================================================

-- ─── 1) Audit av auto-onboards ─────────────────────────────────
BEGIN;

CREATE TABLE IF NOT EXISTS customer_auto_onboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  triggered_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  website_url TEXT NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_name VARCHAR(160),
  contact_phone VARCHAR(50),

  project_id VARCHAR(255),
  customer_id TEXT,
  brreg_org_number VARCHAR(20),
  brreg_name VARCHAR(255),
  logo_url TEXT,
  needs_count INT DEFAULT 0,
  signals_count INT DEFAULT 0,
  composite_score INT,
  client_token VARCHAR(64),

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'duplicate')),
  error_message TEXT,

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_auto_onboards_org
  ON customer_auto_onboards(organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_onboards_website
  ON customer_auto_onboards(website_url, organization_id);

COMMIT;

-- ─── 2) Klient-portal-tokens ───────────────────────────────────
BEGIN;

CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL,
  customer_id TEXT,

  token VARCHAR(64) NOT NULL UNIQUE,

  invited_email VARCHAR(255) NOT NULL,
  invited_name VARCHAR(160),
  invited_role VARCHAR(40) DEFAULT 'client_viewer',

  first_opened_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  view_count INT NOT NULL DEFAULT 0,

  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '90 days'),
  revoked_at TIMESTAMPTZ,
  revoked_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  revoke_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_client_tokens_project
  ON client_portal_tokens(project_id, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_tokens_email
  ON client_portal_tokens(invited_email, expires_at);

COMMIT;

-- ─── 3) Leveranser ─────────────────────────────────────────────
-- Eksisterende project_deliverables har bare (id, created_at, updated_at).
-- Vi utvider den i stedet for å lage en ny. ALTER ADD COLUMN IF NOT EXISTS
-- er trygt.
BEGIN;

ALTER TABLE project_deliverables
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS title VARCHAR(200),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS related_need_type VARCHAR(60),
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS is_visible_to_client BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS client_summary TEXT,
  ADD COLUMN IF NOT EXISTS target_date DATE,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS evidence_url TEXT,
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

-- Status-CHECK kun hvis ikke allerede satt
DO $$
BEGIN
  ALTER TABLE project_deliverables
    ADD CONSTRAINT project_deliverables_status_check
    CHECK (status IS NULL OR status IN
           ('planned', 'in_progress', 'ready_for_review',
            'completed', 'blocked', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FK på organization_id
DO $$
BEGIN
  ALTER TABLE project_deliverables
    ADD CONSTRAINT project_deliverables_org_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_deliverables_project_status
  ON project_deliverables(project_id, status);

COMMIT;
