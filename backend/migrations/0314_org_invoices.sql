-- 0314_org_invoices.sql
-- Lokal kopi av Stripe-fakturaer per organisasjon (Leadgrid-subs).
-- Gjør at superadmin kan vise MRR/lifetime/recent-invoices uten å
-- query'e Stripe på hver page-load.
CREATE TABLE IF NOT EXISTS org_invoices (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_invoice_id      VARCHAR(120) UNIQUE NOT NULL,
  stripe_subscription_id VARCHAR(120),
  stripe_customer_id     VARCHAR(120),
  amount_due_oere        INT NOT NULL DEFAULT 0,
  amount_paid_oere       INT NOT NULL DEFAULT 0,
  vat_oere               INT NOT NULL DEFAULT 0,
  currency               VARCHAR(10) NOT NULL DEFAULT 'nok',
  status                 VARCHAR(40) NOT NULL,
  period_start           TIMESTAMPTZ,
  period_end             TIMESTAMPTZ,
  invoice_number         VARCHAR(120),
  hosted_invoice_url     TEXT,
  invoice_pdf_url        TEXT,
  plan_key               VARCHAR(40),
  description            TEXT,
  leadgrid_mail_sent_at  TIMESTAMPTZ,
  raw_event              JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_invoices_org_time ON org_invoices (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_invoices_status ON org_invoices (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_invoices_stripe_sub ON org_invoices (stripe_subscription_id);
