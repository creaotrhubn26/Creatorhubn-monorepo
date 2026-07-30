-- 0451_role_room_budget_templates.sql
--
-- Del A punkt 105 (budsjett-onboarding) og 106 (maler med norske kategorier).
--
-- QA-observasjonen bak 105 var «0/0/0 på aktivt prosjekt» — altså et
-- adopsjonsproblem, ikke en manglende funksjon. Budsjettmodulen finnes, men et
-- tomt regneark er en høy terskel: den som ikke vet hvilke linjer et
-- reklamebudsjett SKAL ha, begynner ikke.
--
-- Kategori-vokabularet finnes allerede (migrering 135, ATL/PRE/PROD/LOG/POST/
-- OH). Det som manglet var startsettet med faktiske LINJER — en mal man kan
-- fylle ut framfor et blankt ark.
--
-- Malene er bevisst korte. En mal med 80 linjer er like avskrekkende som et
-- tomt ark; disse dekker det de fleste produksjoner faktisk fakturerer, og
-- resten legges til ved behov.

CREATE TABLE IF NOT EXISTS role_room_budget_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stabil nøkkel brukt av klienten; navnet kan endres uten å brekke noe.
  template_key  VARCHAR(60) NOT NULL UNIQUE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,

  -- Prosjekttypene malen foreslås for (casting_projects.project_type).
  -- Tom liste = foreslås for alle.
  project_types TEXT[] NOT NULL DEFAULT '{}',

  -- Systemmaler kan ikke slettes av brukere; egendefinerte kan.
  is_system     BOOLEAN NOT NULL DEFAULT FALSE,
  owner_user_id VARCHAR(255),

  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_room_budget_template_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES role_room_budget_templates(id) ON DELETE CASCADE,

  -- Speiler role_room_budget_items.
  phase         VARCHAR(32) NOT NULL CHECK (phase IN ('preproduction','production','postproduction')),
  category      VARCHAR(120) NOT NULL,
  item_name     VARCHAR(255) NOT NULL,
  description   TEXT,

  -- Bevisst 0: malen sier HVA man skal budsjettere, ikke hvor mye. Et gjettet
  -- kronebeløp ville sett ut som et estimat noen hadde regnet på.
  default_estimate NUMERIC(12,2) NOT NULL DEFAULT 0,

  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rr_budget_template_lines_template
  ON role_room_budget_template_lines (template_id, sort_order);

COMMENT ON TABLE role_room_budget_templates IS
  'Startsett med budsjettlinjer (Del A punkt 106). Adresserer at et tomt regneark ikke blir fylt ut.';
COMMENT ON COLUMN role_room_budget_template_lines.default_estimate IS
  'Alltid 0. Malen sier hva som skal budsjetteres, ikke hvor mye — et gjettet beløp ville sett ut som et estimat.';

-- ── Systemmaler ──────────────────────────────────────────────────────────

DO $$
DECLARE
  reklame_id UUID;
  kortfilm_id UUID;
  dok_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM role_room_budget_templates WHERE is_system) THEN
    RETURN;
  END IF;

  -- ── Reklame ────────────────────────────────────────────────────────────
  INSERT INTO role_room_budget_templates (template_key, name, description, project_types, is_system, sort_order)
  VALUES ('reklamefilm', 'Reklamefilm',
          'Standard linjer for reklameproduksjon. Merk buyout som egen linje — for reklame er rettighetene ofte den største enkeltposten.',
          ARRAY['commercial','promo','video','product','fashion']::text[], TRUE, 10)
  RETURNING id INTO reklame_id;

  INSERT INTO role_room_budget_template_lines (template_id, phase, category, item_name, description, sort_order) VALUES
    (reklame_id, 'preproduction', 'Produsent-honorar', 'Produsent', NULL, 100),
    (reklame_id, 'preproduction', 'Regi-honorar', 'Regi', NULL, 110),
    (reklame_id, 'preproduction', 'Casting', 'Casting-honorar', NULL, 120),
    (reklame_id, 'preproduction', 'Casting', 'Studioleie audition', NULL, 130),
    (reklame_id, 'preproduction', 'Location scouting', 'Recce og lokasjonssøk', NULL, 140),
    (reklame_id, 'production',    'Hovedcast', 'Skuespillere – dagshonorar', NULL, 200),
    (reklame_id, 'production',    'Hovedcast', 'Buyout / rettigheter',
     'Territorium, medieflater og periode. Se buyout-vilkårene på kontrakten.', 210),
    (reklame_id, 'production',    'Hovedcast', 'Statister', NULL, 220),
    (reklame_id, 'production',    'Kamera', 'Kamerateam', NULL, 230),
    (reklame_id, 'production',    'Kamera', 'Kamerapakke (leie)', NULL, 240),
    (reklame_id, 'production',    'Lys / Grip', 'Lys- og griprigg', NULL, 250),
    (reklame_id, 'production',    'Lyd', 'Lydopptak på set', NULL, 260),
    (reklame_id, 'production',    'Art / Scenografi', 'Scenografi og rekvisitter', NULL, 270),
    (reklame_id, 'production',    'Kostyme', 'Kostyme', NULL, 280),
    (reklame_id, 'production',    'Maske', 'Maske og hår', NULL, 290),
    (reklame_id, 'production',    'Locations & permits', 'Lokasjonsleie og tillatelser', NULL, 300),
    (reklame_id, 'production',    'Catering', 'Catering', NULL, 310),
    (reklame_id, 'production',    'Transport / frakt', 'Transport', NULL, 320),
    (reklame_id, 'postproduction','Klipp', 'Klipp', NULL, 400),
    (reklame_id, 'postproduction','Color / DI', 'Fargekorreksjon', NULL, 410),
    (reklame_id, 'postproduction','Lyd-design', 'Lydmiks', NULL, 420),
    (reklame_id, 'postproduction','Musikk', 'Musikk og lisens', NULL, 430),
    (reklame_id, 'postproduction','Forsikring', 'Produksjonsforsikring', NULL, 500),
    (reklame_id, 'postproduction','Kontingens', 'Uforutsett (10 %)',
     'Bransjenorm er 8–12 % av totalbudsjettet.', 510);

  -- ── Kortfilm ───────────────────────────────────────────────────────────
  INSERT INTO role_room_budget_templates (template_key, name, description, project_types, is_system, sort_order)
  VALUES ('kortfilm', 'Kortfilm / dramaproduksjon',
          'Linjer for dramatisert kortfilm. Dekker rettighetsklarering og etterarbeid.',
          ARRAY['video','documentary','theater']::text[], TRUE, 20)
  RETURNING id INTO kortfilm_id;

  INSERT INTO role_room_budget_template_lines (template_id, phase, category, item_name, description, sort_order) VALUES
    (kortfilm_id, 'preproduction', 'Manus & rettigheter', 'Manusarbeid', NULL, 100),
    (kortfilm_id, 'preproduction', 'Regi-honorar', 'Regi', NULL, 110),
    (kortfilm_id, 'preproduction', 'Produsent-honorar', 'Produsent', NULL, 120),
    (kortfilm_id, 'preproduction', 'Casting', 'Casting', NULL, 130),
    (kortfilm_id, 'preproduction', 'Storyboard', 'Storyboard', NULL, 140),
    (kortfilm_id, 'production',    'Hovedcast', 'Skuespillere', NULL, 200),
    (kortfilm_id, 'production',    'Kamera', 'Foto og kamerateam', NULL, 210),
    (kortfilm_id, 'production',    'Lys / Grip', 'Lys og grip', NULL, 220),
    (kortfilm_id, 'production',    'Lyd', 'Lyd på set', NULL, 230),
    (kortfilm_id, 'production',    'Art / Scenografi', 'Scenografi', NULL, 240),
    (kortfilm_id, 'production',    'Locations & permits', 'Lokasjoner', NULL, 250),
    (kortfilm_id, 'production',    'Reise & overnatting', 'Reise og opphold', NULL, 260),
    (kortfilm_id, 'production',    'Catering', 'Catering', NULL, 270),
    (kortfilm_id, 'postproduction','Klipp', 'Klipp', NULL, 400),
    (kortfilm_id, 'postproduction','Lyd-design', 'Lyddesign og miks', NULL, 410),
    (kortfilm_id, 'postproduction','Color / DI', 'Fargekorreksjon', NULL, 420),
    (kortfilm_id, 'postproduction','Musikk', 'Musikk', NULL, 430),
    (kortfilm_id, 'postproduction','Lisensering', 'Klarering av rettigheter', NULL, 440),
    (kortfilm_id, 'postproduction','Kontingens', 'Uforutsett', NULL, 500);

  -- ── Dokumentar ─────────────────────────────────────────────────────────
  INSERT INTO role_room_budget_templates (template_key, name, description, project_types, is_system, sort_order)
  VALUES ('dokumentar', 'Dokumentar',
          'Dokumentarproduksjon: lengre opptaksperiode, mindre team, mer arkiv og klarering.',
          ARRAY['documentary','interview','corporate']::text[], TRUE, 30)
  RETURNING id INTO dok_id;

  INSERT INTO role_room_budget_template_lines (template_id, phase, category, item_name, description, sort_order) VALUES
    (dok_id, 'preproduction', 'Manus & rettigheter', 'Research', NULL, 100),
    (dok_id, 'preproduction', 'Regi-honorar', 'Regi', NULL, 110),
    (dok_id, 'preproduction', 'Produsent-honorar', 'Produsent', NULL, 120),
    (dok_id, 'production',    'Kamera', 'Foto', NULL, 200),
    (dok_id, 'production',    'Lyd', 'Lyd', NULL, 210),
    (dok_id, 'production',    'Reise & overnatting', 'Reise og opphold', NULL, 220),
    (dok_id, 'production',    'Transport / frakt', 'Transport', NULL, 230),
    (dok_id, 'postproduction','Klipp', 'Klipp', NULL, 400),
    (dok_id, 'postproduction','Lisensering', 'Arkivmateriale og klarering',
     'Ofte undervurdert i dokumentar — arkivklipp kan koste mer enn opptaket.', 410),
    (dok_id, 'postproduction','Lyd-design', 'Lydmiks', NULL, 420),
    (dok_id, 'postproduction','Musikk', 'Musikk', NULL, 430),
    (dok_id, 'postproduction','Kontingens', 'Uforutsett', NULL, 500);
END $$;
