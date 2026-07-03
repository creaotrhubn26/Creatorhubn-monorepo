-- =====================================================================
-- mig 0361 — Leadgrid Sales Teams + Lead Assignments
--
-- Flytter team-oppsettet (LeadgridSalesTeamStore) og lead-tildelinger
-- (AssignToTeamMemberSheet) fra iPad-lokal UserDefaults til backend,
-- slik at salgssjefens team-struktur og «Send oppdrag»-tildelinger
-- er synkronisert på tvers av enheter og web.
--
-- Tabeller som lages (2):
--   1. leadgrid_sales_teams      — team m/ navn, farge, leder, medlemmer
--                                  (JSONB user-id-array) + allokert
--                                  sirkel-område på kartet.
--   2. leadgrid_lead_assignments — «Reis dit og prat med dem»-oppdrag:
--                                  lead → selger/promotør m/ melding,
--                                  prioritet og status-livssyklus.
--
-- Konvensjoner:
--   • organization_id = VARCHAR(255) UTEN FK. resolveOrgIdForUser()
--     returnerer enterprise_team_members.organization_id som i praksis
--     inneholder både UUID-er, slugs («norwedfilm») og user-ids
--     (solo-modus) — ingen av dem er garantert i organizations(id).
--     (0354-familien har UUID-FK og knekker derfor for disse verdiene.)
--   • users(id) = VARCHAR(255) (IKKE UUID) — matcher 0358.
--   • leadgrid_sales_teams.id er KLIENT-generert TEXT (iPad-modellen
--     bruker strings som «team-a»), scoped per org →
--     PRIMARY KEY (organization_id, id) + upsert ON CONFLICT.
--   • Idempotent — IF NOT EXISTS overalt, trygg å kjøre 2 ganger.
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. leadgrid_sales_teams — team-struktur per org
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_sales_teams (
  organization_id  VARCHAR(255) NOT NULL,
  id               TEXT NOT NULL,
  name             TEXT NOT NULL,
  color_hex        VARCHAR(9) NOT NULL DEFAULT '#a852fc',
  leader_user_id   VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  -- User-ids som JSONB-array (["u1","u2"]) — speiler iPad-modellen
  -- direkte og unngår join-tabell for små team-lister.
  member_user_ids  JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Allokert sirkel-område på kartet (nil = ingen allokering).
  area_center_lat  DOUBLE PRECISION,
  area_center_lng  DOUBLE PRECISION,
  area_radius_km   DOUBLE PRECISION,
  created_by       VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, id)
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_sales_teams_org
  ON leadgrid_sales_teams(organization_id);

-- ─────────────────────────────────────────────────────────────────────
-- 2. leadgrid_lead_assignments — «Send oppdrag»-tildelinger
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_lead_assignments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      VARCHAR(255) NOT NULL,
  -- crm_customers.id når kjent — nullable siden info-kortet i dag kan
  -- sende tildeling før leaden er persistert (drop-pin o.l.).
  lead_id              UUID,
  lead_name            TEXT NOT NULL,
  lead_lat             DOUBLE PRECISION,
  lead_lng             DOUBLE PRECISION,
  assignee_user_id     VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by_user_id  VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  assignee_role        VARCHAR(20) NOT NULL DEFAULT 'seller'
                       CHECK (assignee_role IN ('seller','promoter','manager')),
  priority             VARCHAR(10) NOT NULL DEFAULT 'normal'
                       CHECK (priority IN ('normal','high','urgent')),
  message              TEXT NOT NULL DEFAULT '',
  status               VARCHAR(20) NOT NULL DEFAULT 'sent'
                       CHECK (status IN ('sent','seen','accepted','completed','cancelled')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_lead_assignments_org
  ON leadgrid_lead_assignments(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leadgrid_lead_assignments_assignee
  ON leadgrid_lead_assignments(assignee_user_id, status);

COMMIT;
