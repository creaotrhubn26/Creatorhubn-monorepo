-- =====================================================================
-- 298_lead_research_orchestrator.sql
--
-- Utvider market_scans til å fungere som research-orkestrator for
-- "research → leads dukker opp"-flyten. Bryterne brukes av
-- lead-map-research-routes.ts som kjører fasene sekvensielt:
--
--   1. brand_kit         (valgfri) Brand-scan på org's egen website
--   2. claude_scan       Claude Market Scan finner konkurrenter
--   3. geocode_competitors  Google Places-oppslag for hver competitor
--   4. creating_leads    Insert i crm_customers m/ target_org_id-scope
--   5. done              Klart — leadene dukker opp på iPad-kartet
--
-- Hele flowen er gated på ny permission `lead_research.run`. Default
-- tildelt admin + salgssjef. Organisasjonen kan toggle av/på pr rolle
-- eller pr bruker via eksisterende role_permissions / user_permission_
-- overrides-mekanikk.
-- =====================================================================

BEGIN;

-- ─── Research-orkestrator-felter ───────────────────────────────
ALTER TABLE market_scans
  -- True når denne scan'en skal opprette crm_customers-rader for
  -- hver competitor m/ verifisert geo. False = bare en
  -- markeds-rapport uten leads.
  ADD COLUMN IF NOT EXISTS auto_create_leads BOOLEAN NOT NULL DEFAULT false,
  -- Hvilken org skal leadene scopes til? Settes ved /research/start.
  -- (market_scans har allerede workspace_owner_user_id; vi separerer
  -- target-org så salgssjef i org A kan kjøre research mens leadene
  -- havner i org B hvis de har lov til det — vanligvis samme org.)
  ADD COLUMN IF NOT EXISTS target_org_id UUID
    REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS leads_created_count INT NOT NULL DEFAULT 0,
  -- Fase-tracking for live progress på iPad. Synkronisert m/
  -- run-orkestratorens steg så ResearchProgressView kan tegne
  -- 'checkmark.circle.fill' / 'circle.dotted' / 'circle' per steg.
  ADD COLUMN IF NOT EXISTS phase VARCHAR(40) NOT NULL DEFAULT 'pending'
    CHECK (phase IN (
      'pending', 'brand_kit', 'claude_scan',
      'geocode_competitors', 'creating_leads', 'done', 'failed'
    )),
  ADD COLUMN IF NOT EXISTS phase_message TEXT;

-- Index for iPad-en sin "siste research-økter for min org"
CREATE INDEX IF NOT EXISTS idx_market_scans_target_org_phase
  ON market_scans(target_org_id, phase, created_at DESC)
  WHERE target_org_id IS NOT NULL;

-- ─── Ny RBAC-permission ────────────────────────────────────────
INSERT INTO permissions (key, category, description) VALUES
  ('lead_research.run', 'Lead Research',
   'Starte research-økter som auto-genererer leads på kartet')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      description = EXCLUDED.description;

-- Default-tildeling
INSERT INTO role_permissions (role, permission_key) VALUES
  ('salgssjef', 'lead_research.run'),
  ('teamleder', 'lead_research.run')
ON CONFLICT (role, permission_key) DO NOTHING;

-- selger + promotor får IKKE default — orgen må eksplisitt overstyre
-- via user_permission_overrides hvis de vil at en selger skal kunne
-- kjøre research selv.

COMMIT;
