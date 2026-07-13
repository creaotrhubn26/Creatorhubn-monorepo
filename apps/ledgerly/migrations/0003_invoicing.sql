-- Fakturamodul: produkter, utgående fakturaer og fakturalinjer.
-- Prinsipper som ellers: BIGINT-ører, tenant-tilhørighet, revisjonsfelter,
-- kontrollert nummerserie uten hull, ingen sletting av utstedte fakturaer.

CREATE TABLE products (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'stk',
  unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0), -- eks. mva
  vat_code TEXT NOT NULL DEFAULT '3',
  revenue_account TEXT NOT NULL DEFAULT '3000',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived'))
);
CREATE INDEX products_org_idx ON products (organization_id, status);

CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  -- NULL til fakturaen utstedes; da tildeles neste nummer i serien.
  invoice_number BIGINT,
  kind TEXT NOT NULL DEFAULT 'invoice' CHECK (kind IN ('invoice','credit_note')),
  credits_invoice_id UUID REFERENCES invoices(id), -- satt for kreditnotaer
  invoice_date DATE,
  due_date DATE,
  kid TEXT,
  currency TEXT NOT NULL DEFAULT 'NOK',
  net_minor BIGINT NOT NULL DEFAULT 0,
  vat_minor BIGINT NOT NULL DEFAULT 0,
  gross_minor BIGINT NOT NULL DEFAULT 0,
  paid_minor BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','issued','paid','credited','cancelled')),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INT NOT NULL DEFAULT 1,
  UNIQUE (organization_id, invoice_number)
);
CREATE INDEX invoices_org_status_idx ON invoices (organization_id, status);
CREATE INDEX invoices_kid_idx ON invoices (organization_id, kid) WHERE kid IS NOT NULL;

CREATE TABLE invoice_lines (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  line_number INT NOT NULL,
  product_id UUID REFERENCES products(id),
  description TEXT NOT NULL,
  quantity_thousandths BIGINT NOT NULL CHECK (quantity_thousandths > 0), -- antall × 1000 (eksakt)
  unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0), -- eks. mva
  vat_code TEXT NOT NULL,
  revenue_account TEXT NOT NULL DEFAULT '3000',
  net_minor BIGINT NOT NULL,
  vat_minor BIGINT NOT NULL,
  UNIQUE (invoice_id, line_number)
);

-- Egen nummerserie for fakturaer (adskilt fra bilagsnummer).
ALTER TABLE organization_counters ADD COLUMN next_invoice_number BIGINT NOT NULL DEFAULT 1;

-- Innbetalingsmatching: et treff kan peke på en faktura.
ALTER TABLE reconciliation_matches ADD COLUMN invoice_id UUID REFERENCES invoices(id);

-- Utstedte fakturaer er uforanderlige (rettes med kreditnota).
-- Tillatte endringer etter utstedelse: status/paid_minor/updated_at/version.
CREATE OR REPLACE FUNCTION invoices_guard() RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    IF (NEW.id, NEW.organization_id, NEW.customer_id, NEW.invoice_number, NEW.kind,
        NEW.credits_invoice_id, NEW.invoice_date, NEW.due_date, NEW.kid, NEW.currency,
        NEW.net_minor, NEW.vat_minor, NEW.gross_minor, NEW.journal_entry_id, NEW.created_by, NEW.created_at)
       IS DISTINCT FROM
       (OLD.id, OLD.organization_id, OLD.customer_id, OLD.invoice_number, OLD.kind,
        OLD.credits_invoice_id, OLD.invoice_date, OLD.due_date, OLD.kid, OLD.currency,
        OLD.net_minor, OLD.vat_minor, OLD.gross_minor, OLD.journal_entry_id, OLD.created_by, OLD.created_at) THEN
      RAISE EXCEPTION 'Utstedte fakturaer kan ikke endres. Bruk kreditnota.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoices_update_guard
  BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION invoices_guard();

CREATE OR REPLACE FUNCTION invoices_no_delete_issued() RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Utstedte fakturaer kan ikke slettes (sporbarhet). Bruk kreditnota.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoices_delete_guard
  BEFORE DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION invoices_no_delete_issued();
