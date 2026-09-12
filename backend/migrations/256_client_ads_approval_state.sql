-- =====================================================================
-- 256_client_ads_approval_state.sql
--
-- Plugger client_ads_configs inn i eksisterende approval-state-mønster
-- (role-room-material-approval.ts §5.1-5.2 fra MedInnova-avtalen).
--
-- Gjenbruker:
--   - notifications-tabell (admin-notifications-routes.ts)
--   - client_reviewer-rolle (auth-routes.ts)
--   - 3-business-dager auto-godkjenning (MATERIAL_REVIEW_BUSINESS_DAYS)
--
-- Sletter PR-planlagt ny notification-tabell — gjenbruker eksisterende.
-- =====================================================================

BEGIN;

ALTER TABLE client_ads_configs
  -- State-machine (samme verdier som role-room-feed-plan §5.1)
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft','awaiting_client','approved','rejected','revision_requested')),

  -- Når producer sendte til klient
  ADD COLUMN IF NOT EXISTS sent_for_approval_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_for_approval_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_message TEXT,           -- Producer's beskjed til klient
  ADD COLUMN IF NOT EXISTS review_deadline TIMESTAMPTZ,     -- Auto-approve etter denne (§5.2)

  -- Når klient bestemte seg
  ADD COLUMN IF NOT EXISTS client_decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_decided_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_feedback TEXT;            -- Klient kan be om endringer

CREATE INDEX IF NOT EXISTS idx_client_ads_configs_approval
  ON client_ads_configs(approval_status, sent_for_approval_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_ads_configs_pending_client
  ON client_ads_configs(client_project_id, approval_status)
  WHERE approval_status = 'awaiting_client';

COMMIT;
