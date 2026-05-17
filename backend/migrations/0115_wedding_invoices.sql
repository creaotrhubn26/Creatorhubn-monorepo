-- 0115_wedding_invoices.sql
-- Post-bryllup faktura-snapshot (Slice 9X.41).
-- En rad per generert faktura — Stine kan ha flere drafter per bryllup.
-- Lines er JSONB-snapshot så endringer i underliggende data (utlegg,
-- kjøregodtg.) ikke endrer en sendt faktura.

CREATE TABLE IF NOT EXISTS wedding_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id VARCHAR(64) NOT NULL,
  photographer_id TEXT NOT NULL,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_kr NUMERIC(10,2) NOT NULL DEFAULT 0,
  mva_kr NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_kr NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  delivery_channel TEXT,
  -- 'email' | 'poweroffice' | 'vipps' | 'manual'
  poweroffice_invoice_id TEXT,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wedding_invoices_wedding
  ON wedding_invoices (wedding_id);
CREATE INDEX IF NOT EXISTS idx_wedding_invoices_status
  ON wedding_invoices (photographer_id, status, created_at DESC);
