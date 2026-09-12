-- 0397: Dørsalg-modus — husstands-status (vunnet/avslått) per org.
-- Adresser hentes live fra Kartverket (lagres IKKE som leads/CRM);
-- statusen en selger setter på døra er derimot org-data og persisteres
-- her, keyet på Kartverkets adresse-identitet (adressetekst|postnummer).

CREATE TABLE IF NOT EXISTS leadgrid_dorsalg_status (
  org_id       TEXT NOT NULL,
  adresse_id   TEXT NOT NULL,          -- "adressetekst|postnummer"
  adressetekst TEXT NOT NULL DEFAULT '',
  postnummer   TEXT NOT NULL DEFAULT '',
  poststed     TEXT NOT NULL DEFAULT '',
  lat          DOUBLE PRECISION,
  lon          DOUBLE PRECISION,
  status       TEXT NOT NULL CHECK (status IN ('vunnet', 'avslatt')),
  set_by       TEXT,                   -- user_id som satte statusen
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, adresse_id)
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_dorsalg_status_org
  ON leadgrid_dorsalg_status (org_id, updated_at DESC);
