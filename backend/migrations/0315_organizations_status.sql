-- 0315_organizations_status.sql
-- Lar superadmin sette organisasjoner på pause/read-only/suspend.
-- Drevet av superadmin-routes.ts pause/resume/suspend-endepunkter +
-- enforceOrgStatus()-middleware.
--
-- status:
--   active     - normal drift
--   paused     - midlertidig pause (Stripe pause_collection settes)
--   read_only  - kan se data, ikke endre. Bra for vedlikehold.
--   suspended  - kan ikke logge inn. ToS-brudd / sikkerhetsincident.
--   closed    - definitivt avsluttet (mengde-rapport-mål)

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS status         VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS paused_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_by      VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pause_reason   TEXT,
  ADD COLUMN IF NOT EXISTS pause_resume_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='organizations_status_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_status_check
      CHECK (status IN ('active','paused','read_only','suspended','closed'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_organizations_status
  ON organizations (status) WHERE status != 'active';
