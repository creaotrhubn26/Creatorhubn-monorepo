-- =====================================================================
-- 0375_module_feature_entitlements.sql
--
-- CTO-audit fase 1 (2026-07-10): generisk, modul-uavhengig feature-
-- entitlement-tabell, modellert direkte på leadgrid_org_entitlements
-- (0370) men uten å være Leadgrid-spesifikk.
--
-- leadgrid_org_entitlements endres IKKE og droppes IKKE av denne
-- migrasjonen — konsolidering dit er et eget, senere steg (se
-- docs/cto-audit/11-migration-plan.md, steg 7) etter at denne generiske
-- tabellen har fartstid i produksjon for minst to moduler
-- (market_intelligence + leadgrid).
--
-- Samme bakoverkompatible egenskap som 0370: ingen rad for en
-- (organization_id, module_key, feature_key, environment) = ingen
-- override = default (kodekonstant) gjelder.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS module_feature_entitlements (
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id        UUID,                  -- NULL = org-wide override
  module_key          VARCHAR(80) NOT NULL,  -- 'market_intelligence' | 'leadgrid' | ...
  feature_key         VARCHAR(80) NOT NULL,  -- 'core' | 'route_planning' | 'ai_recommendations' | ...
  state               VARCHAR(16) NOT NULL
                      CHECK (state IN ('included','trial','add_on','locked')),
  monthly_limit       INTEGER,
  trial_ends_at       TIMESTAMPTZ,
  environment         VARCHAR(20) NOT NULL DEFAULT 'production'
                      CHECK (environment IN ('production','staging','development')),
  updated_by          VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, module_key, feature_key, environment)
);

CREATE INDEX IF NOT EXISTS idx_module_feature_entitlements_workspace
  ON module_feature_entitlements (workspace_id)
  WHERE workspace_id IS NOT NULL;

COMMIT;
