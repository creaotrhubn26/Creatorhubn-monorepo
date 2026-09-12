-- 0377: Kvalitet-avdelingen (Sales QA) — verifiseringskø + samtale-maler (2026-07-16).
-- Vunnede salg (crm_customers.pipeline_stage='won') backfilles lat inn i køen av
-- GET /api/leadgrid/quality/queue. Kontrolløren ringer kunden med mal (intro +
-- spørsmål m/ sjekk-hint per produkt) og feller verdikt.

CREATE TABLE IF NOT EXISTS leadgrid_verification_templates (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  intro_script TEXT NOT NULL DEFAULT '',
  questions JSONB NOT NULL DEFAULT '[]',
  outro_script TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lg_vtempl_org
  ON leadgrid_verification_templates (organization_id, is_active);

CREATE TABLE IF NOT EXISTS leadgrid_sales_verifications (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT,
  seller_user_id TEXT,
  seller_name TEXT,
  deal_amount NUMERIC,
  deal_currency TEXT,
  won_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',          -- pending|verified|rejected|needs_followup
  template_id UUID,
  answers JSONB NOT NULL DEFAULT '[]',             -- [{questionId, question, result, note}]
  reason_code TEXT,                                -- ved rejected (feil_pris|kunde_angret|…)
  note TEXT NOT NULL DEFAULT '',
  call_outcome TEXT,                               -- reached|no_answer|callback
  verified_by TEXT,
  verified_by_name TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lg_sverif_org_customer
  ON leadgrid_sales_verifications (organization_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_lg_sverif_org_status
  ON leadgrid_sales_verifications (organization_id, status, created_at DESC);
