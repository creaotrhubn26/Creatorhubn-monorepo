-- Kostnadsbærere: prosjekter og avdelinger.
-- journal_lines har allerede tekstkolonnene project/department; disse
-- tabellene er registeret de valideres mot ved bokføring. Kodene er stabile
-- identifikatorer (endres ikke); navn kan endres.

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL, -- kort stabil kode, f.eks. 'P-001' eller 'BRYLLUP24'
  name TEXT NOT NULL,
  description TEXT,
  customer_id UUID REFERENCES customers(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  UNIQUE (organization_id, code)
);

CREATE TABLE departments (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  UNIQUE (organization_id, code)
);

-- Inntektssiden: fakturalinjer kan knyttes til prosjekt, slik at
-- lønnsomhetsrapporten får både inntekter og kostnader per prosjekt.
ALTER TABLE invoice_lines ADD COLUMN project TEXT;

CREATE INDEX journal_lines_org_project_idx ON journal_lines (organization_id, project)
  WHERE project IS NOT NULL;
CREATE INDEX journal_lines_org_department_idx ON journal_lines (organization_id, department)
  WHERE department IS NOT NULL;
