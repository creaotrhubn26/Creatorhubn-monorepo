-- Fastsatt forskuddsskatt per termin (fra Skatteetatens forskuddsutskriving).
-- Brukes i likviditetstrappen i stedet for jevn R/4-fordeling når den finnes.
CREATE TABLE advance_tax_installments (
  id              UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  year            INT  NOT NULL,
  term_no         INT  NOT NULL CHECK (term_no BETWEEN 1 AND 4),
  due_date        DATE NOT NULL,
  amount_minor    BIGINT NOT NULL CHECK (amount_minor >= 0),
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, year, term_no)
);
CREATE INDEX ati_org_year ON advance_tax_installments (organization_id, year);
