-- 0400: Dørsalg-salg — ekte avtaler registrert på døra («Registrer salg»).
-- Grandma-prinsippet: ALDRI kontonummer/betalingsdata i appen — betalingen
-- etableres hos oppdragsgivers kanal (AvtaleGiro/Vipps, signering_url på
-- produktet). Verifiseringshierarki: uverifisert → kunde_bekreftet (e-post-
-- lenke) → telefon_bekreftet (Kvalitet-samtalen) → bankid_signert.

CREATE TABLE IF NOT EXISTS leadgrid_dorsalg_sales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        TEXT NOT NULL,
  adresse_id    TEXT NOT NULL,
  adressetekst  TEXT NOT NULL DEFAULT '',
  postnummer    TEXT NOT NULL DEFAULT '',
  poststed      TEXT NOT NULL DEFAULT '',
  product_id    UUID,
  product_navn  TEXT,
  bidrag_belop  NUMERIC,          -- kr/mnd kunden sa ja til
  bidrag_label  TEXT,             -- «Fadder», «Fast giver», …
  kunde_navn    TEXT NOT NULL,
  kunde_telefon TEXT NOT NULL DEFAULT '',
  kunde_epost   TEXT,             -- valgfri (grandma har ikke alltid e-post)
  samtykke_tekst TEXT NOT NULL DEFAULT '',   -- teksten kunden godtok (versjonert spor)
  samtykke_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ring_bekreftet_at TIMESTAMPTZ,  -- «Ring for å bekrefte» brukt på døra
  verifisering  TEXT NOT NULL DEFAULT 'uverifisert'
    CHECK (verifisering IN ('uverifisert', 'kunde_bekreftet',
                            'telefon_bekreftet', 'bankid_signert')),
  confirm_token TEXT UNIQUE,      -- velkomst-e-postens bekreftelseslenke
  kunde_bekreftet_at TIMESTAMPTZ,
  levert_oppdragsgiver_at TIMESTAMPTZ,
  seller_user_id TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dorsalg_sales_org
  ON leadgrid_dorsalg_sales (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dorsalg_sales_adresse
  ON leadgrid_dorsalg_sales (org_id, adresse_id);

-- Produktkatalogen: prekonfigurert bidrag + samtykke + oppdragsgiver-kanaler.
ALTER TABLE leadgrid_dorsalg_products
  ADD COLUMN IF NOT EXISTS bidrag JSONB NOT NULL DEFAULT '[]';         -- [{belop, label}]
ALTER TABLE leadgrid_dorsalg_products
  ADD COLUMN IF NOT EXISTS samtykke_tekst TEXT NOT NULL DEFAULT '';
ALTER TABLE leadgrid_dorsalg_products
  ADD COLUMN IF NOT EXISTS signering_url TEXT;                          -- AvtaleGiro/Vipps (fylles v/ avtale)
ALTER TABLE leadgrid_dorsalg_products
  ADD COLUMN IF NOT EXISTS leveranse_epost TEXT;                        -- oppdragsgivers mottak
