-- 0399: Dørsalg-produkter — org-en selger for flere oppdragsgivere
-- (SOS Barnebyer, Kirkens Bymisjon, …) og vil ha KPI per produkt.
-- Produkt-tilgang per bruker: salgssjefen bestemmer hvilke produkter en
-- teamleder/selger ser — INGEN rader = alle produkter (default åpen).

CREATE TABLE IF NOT EXISTS leadgrid_dorsalg_products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           TEXT NOT NULL,
  navn             TEXT NOT NULL,
  farge            TEXT NOT NULL DEFAULT '#A855F7',
  aktiv            BOOLEAN NOT NULL DEFAULT true,
  verdi_per_vunnet NUMERIC,      -- provisjonsgrunnlag (kr per vunnet dør)
  sort             INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dorsalg_products_org
  ON leadgrid_dorsalg_products (org_id, aktiv, sort);

CREATE TABLE IF NOT EXISTS leadgrid_dorsalg_product_access (
  org_id     TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  product_id UUID NOT NULL,
  PRIMARY KEY (org_id, user_id, product_id)
);

-- Utfallet på døra bærer produktet. product_navn denormaliseres så
-- historikk/stats overlever at produktet slettes/endres.
ALTER TABLE leadgrid_dorsalg_status ADD COLUMN IF NOT EXISTS product_id UUID;
ALTER TABLE leadgrid_dorsalg_status ADD COLUMN IF NOT EXISTS product_navn TEXT;
