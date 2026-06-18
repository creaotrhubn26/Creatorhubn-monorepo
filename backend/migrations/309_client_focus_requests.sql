-- =====================================================================
-- 309_client_focus_requests.sql
--
-- Klient huker av needs hen ønsker fokusert på i klient-portalen → ny
-- rad i denne tabellen → notification til markedsfører.
--
-- Tilstandsmaskin:
--   pending      → klient har bedt om dette, ikke sett enda
--   acknowledged → markedsfører har sett, ikke startet
--   in_progress  → vi jobber med det (gir også project_deliverables-
--                  rad m/ status='in_progress')
--   completed    → ferdig
--   declined     → markedsfører tror ikke vi skal gjøre dette
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS client_focus_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL,
  customer_id TEXT NOT NULL,
  client_token VARCHAR(64) NOT NULL,

  need_type VARCHAR(60) NOT NULL,
  client_note TEXT,

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'acknowledged', 'in_progress', 'completed', 'declined')),

  assigned_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  UNIQUE (customer_id, need_type)
);
CREATE INDEX IF NOT EXISTS idx_focus_org_status
  ON client_focus_requests(organization_id, status, requested_at DESC);

COMMIT;
