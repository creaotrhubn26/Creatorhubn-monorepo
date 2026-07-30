-- 0452_role_room_checklist_templates.sql
--
-- Del A punkt 58: sjekkliste-maler per fase. «Par med 8 — onboarding-
-- opplevelsen.»
--
-- Samme problem som med budsjettet (105/106): planleggeren finnes, men en tom
-- tidslinje forteller ikke en førstegangsbruker hva en produksjon faktisk
-- består av. Malene her er den forskjellen — man krysser av framfor å finne på.
--
-- Punktene er skrevet som handlinger med et ansvar bak seg, ikke som
-- overskrifter. «Søk om filmtillatelse hos kommunen» er noe man kan gjøre;
-- «Tillatelser» er det ikke.

CREATE TABLE IF NOT EXISTS role_room_checklist_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key  VARCHAR(60) NOT NULL UNIQUE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,

  -- Prosjekttypene malen foreslås for. Tom liste = alle.
  project_types TEXT[] NOT NULL DEFAULT '{}',

  is_system     BOOLEAN NOT NULL DEFAULT FALSE,
  owner_user_id VARCHAR(255),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_room_checklist_template_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES role_room_checklist_templates(id) ON DELETE CASCADE,

  -- Speiler role_room_phase_timeline_items.
  phase         VARCHAR(32) NOT NULL CHECK (phase IN ('preproduction','production','postproduction')),
  title         VARCHAR(255) NOT NULL,
  description   TEXT,

  -- Dager FØR (negativ) eller ETTER (positiv) opptaksstart. Gir malen en
  -- tidsakse uten å binde den til konkrete datoer: fristen regnes ut når
  -- malen tas i bruk på et prosjekt med kjent opptaksdato.
  day_offset    INTEGER,

  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rr_checklist_template_items_template
  ON role_room_checklist_template_items (template_id, sort_order);

COMMENT ON TABLE role_room_checklist_templates IS
  'Sjekkliste-maler per fase (Del A punkt 58). Adresserer at en tom tidslinje ikke forteller hva en produksjon består av.';
COMMENT ON COLUMN role_room_checklist_template_items.day_offset IS
  'Dager relativt til opptaksstart (negativ = før). Frist beregnes ved bruk, ikke lagret i malen.';

-- ── Systemmaler ──────────────────────────────────────────────────────────

DO $$
DECLARE
  reklame_id UUID;
  drama_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM role_room_checklist_templates WHERE is_system) THEN
    RETURN;
  END IF;

  -- ── Reklameproduksjon ──────────────────────────────────────────────────
  INSERT INTO role_room_checklist_templates (template_key, name, description, project_types, is_system, sort_order)
  VALUES ('reklame-standard', 'Reklameproduksjon',
          'Fra brief til levering. Dekker klientgodkjenning, casting, opptak og etterarbeid.',
          ARRAY['commercial','promo','video','product','fashion']::text[], TRUE, 10)
  RETURNING id INTO reklame_id;

  INSERT INTO role_room_checklist_template_items (template_id, phase, title, description, day_offset, sort_order) VALUES
    (reklame_id, 'preproduction', 'Bekreft brief og leveranser med klient',
     'Skriftlig — det er dette scope creep måles mot senere.', -30, 100),
    (reklame_id, 'preproduction', 'Sett opp budsjett og få det godkjent', NULL, -28, 110),
    (reklame_id, 'preproduction', 'Lag rollebeskrivelser og lys ut', NULL, -25, 120),
    (reklame_id, 'preproduction', 'Gjennomfør casting og velg kandidater', NULL, -18, 130),
    (reklame_id, 'preproduction', 'Avklar buyout: territorium, flater og periode',
     'For reklame er dette ofte den største enkeltposten — ta det før tilbudet sendes.', -16, 140),
    (reklame_id, 'preproduction', 'Send tilbud og få kontrakter signert', NULL, -14, 150),
    (reklame_id, 'preproduction', 'Book lokasjon og søk nødvendige tillatelser',
     'Kommunale filmtillatelser har ofte 2–3 ukers behandlingstid.', -21, 160),
    (reklame_id, 'preproduction', 'Book crew og utstyr', NULL, -14, 170),
    (reklame_id, 'preproduction', 'Tegn produksjonsforsikring', NULL, -10, 180),
    (reklame_id, 'preproduction', 'Send call sheet til crew og cast',
     'Sjekk at alle har bekreftet mottatt før dagen før.', -2, 190),
    (reklame_id, 'production',    'Gjennomfør opptaksdag(er)', NULL, 0, 200),
    (reklame_id, 'production',    'Sikre backup av opptak samme dag',
     'To kopier på to fysiske steder før noen drar hjem.', 0, 210),
    (reklame_id, 'postproduction','Lever grovklipp til klient', NULL, 7, 300),
    (reklame_id, 'postproduction','Innarbeid klientens tilbakemeldinger', NULL, 12, 310),
    (reklame_id, 'postproduction','Fargekorreksjon og lydmiks', NULL, 16, 320),
    (reklame_id, 'postproduction','Få skriftlig godkjenning på ferdig film',
     'Versjonert godkjenning — det er denne som gjelder ved uenighet.', 20, 330),
    (reklame_id, 'postproduction','Lever i avtalte formater', NULL, 22, 340),
    (reklame_id, 'postproduction','Arkiver prosjektet og noter rettighetsutløp',
     'Sett en påminnelse før buyout-perioden går ut.', 25, 350);

  -- ── Drama / kortfilm ───────────────────────────────────────────────────
  INSERT INTO role_room_checklist_templates (template_key, name, description, project_types, is_system, sort_order)
  VALUES ('drama-standard', 'Drama / kortfilm',
          'Manusdrevet produksjon: breakdown, stripboard og lengre etterarbeid.',
          ARRAY['video','documentary','theater']::text[], TRUE, 20)
  RETURNING id INTO drama_id;

  INSERT INTO role_room_checklist_template_items (template_id, phase, title, description, day_offset, sort_order) VALUES
    (drama_id, 'preproduction', 'Lås manusversjon for breakdown',
     'Breakdown på et manus som fortsatt endres må gjøres om igjen.', -45, 100),
    (drama_id, 'preproduction', 'Importer manus og gjør scene-breakdown', NULL, -42, 110),
    (drama_id, 'preproduction', 'Sett opp stripboard og opptaksplan', NULL, -35, 120),
    (drama_id, 'preproduction', 'Cast hovedroller', NULL, -30, 130),
    (drama_id, 'preproduction', 'Cast biroller og statister', NULL, -21, 140),
    (drama_id, 'preproduction', 'Avklar arbeidstid for mindreårige',
     'Egne regler for barn — sjekk før planen låses, ikke etter.', -20, 150),
    (drama_id, 'preproduction', 'Recce alle lokasjoner med nøkkel-crew', NULL, -18, 160),
    (drama_id, 'preproduction', 'Book crew, utstyr og transport', NULL, -14, 170),
    (drama_id, 'preproduction', 'Gjennomfør leseprøve', NULL, -7, 180),
    (drama_id, 'preproduction', 'Send call sheet for første opptaksdag', NULL, -2, 190),
    (drama_id, 'production',    'Opptak etter stripboard', NULL, 0, 200),
    (drama_id, 'production',    'Logg skutt/ikke skutt daglig',
     'Uten dette vet ingen hva som gjenstår før siste dag.', 0, 210),
    (drama_id, 'production',    'Skriv dagsrapport', NULL, 0, 220),
    (drama_id, 'postproduction','Klipp råversjon', NULL, 14, 300),
    (drama_id, 'postproduction','Lyddesign og miks', NULL, 30, 310),
    (drama_id, 'postproduction','Fargekorreksjon', NULL, 35, 320),
    (drama_id, 'postproduction','Klarer musikk og arkivmateriale', NULL, 38, 330),
    (drama_id, 'postproduction','Ferdigstill og lever', NULL, 45, 340);
END $$;
