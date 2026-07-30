-- 0458_role_room_funding_export_mappings.sql
--
-- Del A punkt 114: eksport til finansiørenes budsjettformat. Backloggen sier
-- «ingen konkurrent gjør dette», og det stemmer — men det gjør også at det
-- ikke finnes noe å kopiere, og at feil format har en reell kostnad: en
-- søknad til NFI med budsjett i feil oppsett blir sendt i retur.
--
-- **Kartleggingen ligger derfor som DATA, ikke som kode.** NFIs maler endres,
-- og den som oppdager avviket er en produsent midt i en søknadsfrist — ikke en
-- utvikler. Da må raden kunne rettes uten deploy.
--
-- Rader merket `verified = FALSE` er vårt beste utgangspunkt, ikke en bekreftet
-- gjengivelse av gjeldende mal. Eksporten sier fra om dette i klartekst
-- framfor å se autoritativ ut.
--
-- Modellen er generell fordi problemet er det: regionale filmfond og Nordisk
-- Film & TV Fond har egne oppsett, og de har samme form som NFIs.

CREATE TABLE IF NOT EXISTS role_room_funding_schemes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_key    VARCHAR(60) NOT NULL UNIQUE,
  name          VARCHAR(255) NOT NULL,
  organisation  VARCHAR(255),
  description   TEXT,

  -- FALSE = oppsettet er ikke kontrollert mot finansiørens gjeldende mal.
  verified      BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at   DATE,
  source_url    TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_room_funding_category_mappings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id       UUID NOT NULL REFERENCES role_room_funding_schemes(id) ON DELETE CASCADE,

  -- Vår kategori, slik den står i role_room_budget_items.category.
  source_category VARCHAR(120) NOT NULL,

  -- Finansiørens post: kode og betegnelse.
  target_code     VARCHAR(40),
  target_label    VARCHAR(255) NOT NULL,
  target_group    VARCHAR(120),

  sort_order      INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT rr_funding_mapping_unique UNIQUE (scheme_id, source_category)
);

CREATE INDEX IF NOT EXISTS idx_rr_funding_mappings_scheme
  ON role_room_funding_category_mappings (scheme_id, sort_order);

COMMENT ON TABLE role_room_funding_schemes IS
  'Finansiørers budsjettoppsett (Del A punkt 114). verified = FALSE betyr ikke kontrollert mot gjeldende mal.';
COMMENT ON COLUMN role_room_funding_category_mappings.source_category IS
  'Vår kategori fra role_room_budget_items. Kategorier uten kartlegging havner i «ikke kartlagt» i eksporten.';

-- ── Utgangspunkt for NFI ─────────────────────────────────────────────────
-- Bygget på den vanlige norske budsjettinndelingen (over/under streken,
-- produksjon, etterarbeid, overhead). Kodene er PLASSHOLDERE og må erstattes
-- med NFIs faktiske postnummer før innsending — derfor verified = FALSE.

DO $$
DECLARE
  nfi_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM role_room_funding_schemes WHERE scheme_key = 'nfi') THEN
    RETURN;
  END IF;

  INSERT INTO role_room_funding_schemes (scheme_key, name, organisation, description, verified, source_url)
  VALUES ('nfi', 'Norsk filminstitutt — produksjonsbudsjett', 'Norsk filminstitutt',
          'Utgangspunkt basert på vanlig norsk budsjettinndeling. Postkodene er plassholdere og MÅ kontrolleres mot NFIs gjeldende mal før innsending.',
          FALSE, 'https://www.nfi.no/')
  RETURNING id INTO nfi_id;

  INSERT INTO role_room_funding_category_mappings
    (scheme_id, source_category, target_code, target_label, target_group, sort_order)
  VALUES
    -- Over streken
    (nfi_id, 'Manus & rettigheter', 'A.1', 'Manus og rettigheter',      'Over streken', 100),
    (nfi_id, 'Regi-honorar',        'A.2', 'Regi',                      'Over streken', 110),
    (nfi_id, 'Produsent-honorar',   'A.3', 'Produsent',                 'Over streken', 120),
    (nfi_id, 'Hovedcast',           'A.4', 'Medvirkende',               'Over streken', 130),
    -- Under streken: forberedelse
    (nfi_id, 'Casting',             'B.1', 'Casting',                   'Forberedelse', 200),
    (nfi_id, 'Location scouting',   'B.2', 'Lokasjonsarbeid',           'Forberedelse', 210),
    (nfi_id, 'Storyboard',          'B.3', 'Visuell forberedelse',      'Forberedelse', 220),
    (nfi_id, 'Manus-finalisering',  'B.4', 'Manusbearbeiding',          'Forberedelse', 230),
    -- Produksjon
    (nfi_id, 'Kamera',              'C.1', 'Foto',                      'Produksjon',   300),
    (nfi_id, 'Lyd',                 'C.2', 'Lyd',                       'Produksjon',   310),
    (nfi_id, 'Lys / Grip',          'C.3', 'Lys og grip',               'Produksjon',   320),
    (nfi_id, 'Art / Scenografi',    'C.4', 'Scenografi',                'Produksjon',   330),
    (nfi_id, 'Kostyme',             'C.5', 'Kostyme',                   'Produksjon',   340),
    (nfi_id, 'Maske',               'C.6', 'Maske',                     'Produksjon',   350),
    (nfi_id, 'SFX / Stunt',         'C.7', 'Spesialeffekter og stunt',  'Produksjon',   360),
    (nfi_id, 'Locations & permits', 'C.8', 'Lokasjoner og tillatelser', 'Produksjon',   370),
    -- Logistikk
    (nfi_id, 'Reise & overnatting', 'D.1', 'Reise og opphold',          'Logistikk',    400),
    (nfi_id, 'Transport / frakt',   'D.2', 'Transport',                 'Logistikk',    410),
    (nfi_id, 'Catering',            'D.3', 'Forpleining',               'Logistikk',    420),
    (nfi_id, 'Sikkerhet',           'D.4', 'Sikkerhet og HMS',          'Logistikk',    430),
    -- Etterarbeid
    (nfi_id, 'Klipp',               'E.1', 'Klipp',                     'Etterarbeid',  500),
    (nfi_id, 'Lyd-design',          'E.2', 'Lydetterarbeid',            'Etterarbeid',  510),
    (nfi_id, 'VFX',                 'E.3', 'Visuelle effekter',         'Etterarbeid',  520),
    (nfi_id, 'Color / DI',          'E.4', 'Fargekorreksjon og DI',     'Etterarbeid',  530),
    (nfi_id, 'Musikk',              'E.5', 'Musikk',                    'Etterarbeid',  540),
    (nfi_id, 'Lisensering',         'E.6', 'Klarering og lisenser',     'Etterarbeid',  550),
    -- Overhead
    (nfi_id, 'Forsikring',          'F.1', 'Forsikring',                'Overhead',     600),
    (nfi_id, 'Juridisk',            'F.2', 'Juridisk bistand',          'Overhead',     610),
    (nfi_id, 'Bokføring & revisjon','F.3', 'Regnskap og revisjon',      'Overhead',     620),
    (nfi_id, 'Kontingens',          'F.4', 'Uforutsett',                'Overhead',     630);
END $$;
