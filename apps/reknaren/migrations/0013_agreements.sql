-- Avtaler / inntektsplaner: løpende kundeavtaler (abonnement, retainer o.l.) som
-- skal faktureres etter en plan. Grunnlaget for fakturaplan, avtalt-vs-fakturert-
-- kontroll, oppsigelsesfrist-varsel og deteksjon av tapte inntekter.
CREATE TABLE agreements (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  name TEXT NOT NULL,
  -- Avtalt beløp per periode (samme grunnlag som faktura-brutto), i øre.
  amount_minor BIGINT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('monthly','quarterly','yearly','one_time')),
  start_date DATE NOT NULL,
  end_date DATE, -- NULL = løpende
  notice_months INT NOT NULL DEFAULT 0, -- oppsigelsesfrist i måneder
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','paused')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX agreements_org_idx ON agreements (organization_id, status);

-- Valgfri kobling fra faktura til avtalen den oppfyller.
ALTER TABLE invoices ADD COLUMN agreement_id UUID REFERENCES agreements(id);
