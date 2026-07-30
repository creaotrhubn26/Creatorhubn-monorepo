-- 0461_role_room_funding_windows_partners.sql
--
-- To ting som hører til det å faktisk få søkt (Del A punkt 114):
--
-- ── 1. Søknadsvinduer ────────────────────────────────────────────────────
-- Man kan ikke søke når som helst. NFI opplyser at «alle søknadsrunder åpnes
-- for søknader på dagen fire uker før søknadsfrist», og at «for alle
-- søknadsrunder med frist er frist for innsending klokken 12.00 på oppgitt
-- dato». Enkelte ordninger har i stedet løpende saksbehandling — fra januar
-- 2026 gjelder det blant annet utviklingsordningene.
--
-- Konsekvensen for produktet: en søknad som er ferdig er ikke nødvendigvis
-- mulig å sende. Vinduet må vises, ellers oppdager produsenten det først når
-- portalen ikke lar dem laste opp.
--
-- ── 2. Samarbeidspartnere ────────────────────────────────────────────────
-- 80 %-kravet til bekreftet finansiering betyr i praksis at man må ha
-- partnere på plass: regionalt filmfond, distributør, kringkaster,
-- samprodusent. Å registrere HVEM en finansieringskilde er, ikke bare hvor
-- mye den utgjør, gjør at systemet kan si hvilke samarbeid som mangler
-- framfor bare at det mangler penger.

-- ── Ordningens behandlingsform ───────────────────────────────────────────

ALTER TABLE role_room_funding_schemes
  ADD COLUMN IF NOT EXISTS processing_type VARCHAR(20) NOT NULL DEFAULT 'deadline';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rr_funding_scheme_processing_vocab') THEN
    ALTER TABLE role_room_funding_schemes
      ADD CONSTRAINT rr_funding_scheme_processing_vocab
      CHECK (processing_type IN ('deadline', 'rolling'));
  END IF;
END $$;

COMMENT ON COLUMN role_room_funding_schemes.processing_type IS
  'deadline = faste søknadsrunder, rolling = løpende saksbehandling (ingen frist å rekke).';

-- ── Søknadsrunder ────────────────────────────────────────────────────────
-- Datoene er ordningens, ikke prosjektets. De legges inn per runde og kan
-- oppdateres når NFI publiserer nye — derfor data, ikke kode.

CREATE TABLE IF NOT EXISTS role_room_funding_windows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id     UUID NOT NULL REFERENCES role_room_funding_schemes(id) ON DELETE CASCADE,

  label         VARCHAR(255) NOT NULL,
  -- Fristdatoen. Klokkeslettet (12:00) er en regel, ikke en kolonne — se
  -- role-room-funding-window.ts.
  deadline_date DATE NOT NULL,

  -- Normalt fire uker før fristen. Eksplisitt kolonne fordi enkeltrunder kan
  -- avvike, og fordi en utledet dato ingen kan overstyre er en felle.
  opens_date    DATE,

  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rr_funding_window_unique UNIQUE (scheme_id, deadline_date),
  CONSTRAINT rr_funding_window_order CHECK (opens_date IS NULL OR opens_date <= deadline_date)
);

CREATE INDEX IF NOT EXISTS idx_rr_funding_windows_scheme
  ON role_room_funding_windows (scheme_id, deadline_date);

COMMENT ON TABLE role_room_funding_windows IS
  'Søknadsrunder per ordning (Del A punkt 114). Runden åpner normalt fire uker før frist; frist er kl. 12.00.';

-- ── Partnerrolle på finansieringskilder ──────────────────────────────────

ALTER TABLE role_room_financing_sources
  ADD COLUMN IF NOT EXISTS partner_role  VARCHAR(40),
  ADD COLUMN IF NOT EXISTS partner_contact VARCHAR(255);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rr_financing_partner_role_vocab') THEN
    ALTER TABLE role_room_financing_sources
      ADD CONSTRAINT rr_financing_partner_role_vocab
      CHECK (partner_role IS NULL OR partner_role IN (
        'national_fund','regional_fund','distributor','broadcaster',
        'co_producer','sales_agent','sponsor','own_equity','other'
      ));
  END IF;
END $$;

COMMENT ON COLUMN role_room_financing_sources.partner_role IS
  'Hvem kilden er. Lar systemet si hvilke samarbeid som mangler, ikke bare at det mangler penger.';

-- ── Søknadsrunder for NFI ────────────────────────────────────────────────
-- Plassholdere med realistisk form. Datoene MÅ oppdateres mot NFIs publiserte
-- frister — de kunngjøres halvårsvis. Runden åpner fire uker før.

DO $$
DECLARE
  nfi_id UUID;
BEGIN
  SELECT id INTO nfi_id FROM role_room_funding_schemes WHERE scheme_key = 'nfi';
  IF nfi_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM role_room_funding_windows WHERE scheme_id = nfi_id) THEN RETURN; END IF;

  INSERT INTO role_room_funding_windows (scheme_id, label, deadline_date, opens_date, notes)
  VALUES
    (nfi_id, 'Produksjon — runde 1', DATE '2027-02-10', DATE '2027-01-13',
     'Plassholder. Kontroller mot NFIs publiserte frister.'),
    (nfi_id, 'Produksjon — runde 2', DATE '2027-05-12', DATE '2027-04-14',
     'Plassholder. Kontroller mot NFIs publiserte frister.'),
    (nfi_id, 'Produksjon — runde 3', DATE '2027-09-15', DATE '2027-08-18',
     'Plassholder. Kontroller mot NFIs publiserte frister.');
END $$;
