-- 0389_supplier_profile.sql
-- Leverandørprofil per org: hvilke anbudskrav kan dere dokumentere?
-- Grunnlaget for deterministisk «kan vi levere»-vurdering per anbud.
-- capabilities-nøklene speiler TENDER_REQUIREMENT_LEXICON.

CREATE TABLE IF NOT EXISTS supplier_profile (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  capabilities    JSONB NOT NULL DEFAULT '{}'::jsonb, -- { "miljo": true, "kvalitet": false, ... }
  notes           TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
