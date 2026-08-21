-- Skatteavsetning: brukeren registrerer at penger er satt av til skatt.
-- Ren oversikt (anbefalt vs faktisk avsatt) — flytter ALDRI penger selv.
CREATE TABLE tax_reserves (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  amount_minor BIGINT NOT NULL CHECK (amount_minor <> 0),
  reserved_at DATE NOT NULL,
  note TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tax_reserves_org_date ON tax_reserves (organization_id, reserved_at DESC);
