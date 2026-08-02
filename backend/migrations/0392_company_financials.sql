-- 0392_company_financials.sql
-- Bransje-benchmark (Daniels «hva gjør bedrifter bra»): nøkkeltall per
-- selskap fra Regnskapsregisteret, hentet gradvis over prospekt-
-- segmentene. Én rad per (orgnr, år). Deler kilde med lead-berikelsen.

CREATE TABLE IF NOT EXISTS company_financials (
  org_nr           VARCHAR(20) NOT NULL,
  year             INTEGER NOT NULL,
  revenue          NUMERIC(15,2),
  operating_result NUMERIC(15,2),
  net_result       NUMERIC(15,2),
  equity           NUMERIC(15,2),
  total_assets     NUMERIC(15,2),
  operating_margin REAL,
  equity_ratio     REAL,
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_nr, year)
);

-- «har ingen regnskap» må også huskes (ENK leverer ikke) — egen tabell
-- så vi ikke spør API-et om samme selskap hver natt.
CREATE TABLE IF NOT EXISTS company_financials_checked (
  org_nr     VARCHAR(20) PRIMARY KEY,
  has_data   BOOLEAN NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
