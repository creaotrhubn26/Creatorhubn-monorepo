-- =====================================================================
-- 0374_market_intelligence_tenant_and_industry.sql
--
-- CTO-audit fase 1 (2026-07-10): gjør Market Intelligence multi-tenant-klar
-- og bransje-generisk, uten å endre eksisterende adferd.
--
-- Bakgrunn: market_scans (275_market_intelligence.sql) er kun scopet på
-- workspace_owner_user_id (per-bruker), ikke organization_id — motsatt av
-- Leadgrid/CRM som konsekvent er org-scopet. industry er fritekst
-- VARCHAR(200), uten kobling til den allerede eksisterende industries-
-- katalogen (329_leadgrid_industries.sql).
--
-- Denne migrasjonen er rent additiv:
--   - organization_id: nullable, ingen backfill her (kjøres som eget,
--     overvåket script — se docs/cto-audit/11-migration-plan.md).
--   - industry_id: nullable FK → industries. Fritekst-kolonnen `industry`
--     beholdes uendret (samme mønster som crm_customers.industry_id i 329).
--
-- Reversibel:
--   ALTER TABLE market_scans DROP COLUMN organization_id, DROP COLUMN industry_id;
-- =====================================================================

BEGIN;

ALTER TABLE market_scans
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE market_scans
  ADD COLUMN IF NOT EXISTS industry_id UUID REFERENCES industries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_market_scans_organization
  ON market_scans (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_market_scans_industry
  ON market_scans (industry_id)
  WHERE industry_id IS NOT NULL;

COMMIT;
