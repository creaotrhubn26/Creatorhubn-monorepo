-- =====================================================================
-- mig 0363 — Leadgrid tilbud (proposals)
--
-- Lukker funn #7 fra produktrevisjonen 2026-07-03: tilbudssending fantes
-- ikke (`.proposal`-activity-typen var ubrukt og selgere måtte ut i
-- Word/e-post). Nå: selger lager tilbud på iPad → backend sender e-post
-- med offentlig lenke → mottaker åpner → status 'opened' + proposal.opened
-- workflow-event (trigger + leadgrid_proposal_views fantes allerede fra
-- mig 0350-familien — det var selve tilbudet som manglet).
--
-- Konvensjoner: organization_id VARCHAR uten FK (jf. mig 0361 — matcher
-- resolveOrgIdForUser), users(id) VARCHAR, idempotent.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS leadgrid_proposals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   VARCHAR(255) NOT NULL,
  lead_id           UUID NOT NULL,
  title             TEXT NOT NULL,
  message           TEXT NOT NULL DEFAULT '',
  -- Tilbudslinjer: [{"description": "...", "amount_nok": 12345}]
  lines             JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount_nok  NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency          VARCHAR(8) NOT NULL DEFAULT 'NOK',
  valid_until       DATE,
  status            VARCHAR(20) NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sent','opened','accepted','rejected','expired')),
  -- Offentlig token for /api/leadgrid/p/:token (e-post-lenken).
  public_token      VARCHAR(64) NOT NULL UNIQUE,
  sent_to_email     TEXT NOT NULL,
  sent_by_user_id   VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  opened_at         TIMESTAMPTZ,
  responded_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_proposals_org
  ON leadgrid_proposals(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leadgrid_proposals_lead
  ON leadgrid_proposals(lead_id, created_at DESC);

COMMIT;
