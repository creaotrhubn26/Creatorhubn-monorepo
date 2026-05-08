-- Migration 135: role_room_budget_categories
--
-- Standard chart-of-accounts for produksjons-økonomi. System-level
-- rader har project_id=NULL og is_system=TRUE — seedet én gang her
-- og delt på tvers av alle prosjekter. Brukerne kan legge til egne
-- kategorier per prosjekt (project_id satt, is_system=FALSE).
--
-- Hierarkiet matcher norsk filmbransjes vante struktur (NFI/EU):
--   ATL — Above-the-line  (manus, regi, produsent, hovedcast)
--   PRE — Pre-produksjon  (casting, scouting, storyboard, manus)
--   PROD — Produksjon     (kamera, lyd, lys, art, kostyme, maske, ...)
--   LOG — Logistikk       (reise, transport, catering, sikkerhet)
--   POST — Post-produksjon (klipp, lyd-design, VFX, color, musikk, lisens)
--   OH — Overhead         (forsikring, juridisk, regnskap, kontingens)

CREATE TABLE IF NOT EXISTS role_room_budget_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar NULL,
  parent_group varchar NOT NULL,
  parent_group_label varchar NOT NULL,
  category_name varchar NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT FALSE,
  is_archived boolean NOT NULL DEFAULT FALSE,
  created_by varchar,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_budget_categories_project_idx
  ON role_room_budget_categories (project_id) WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS role_room_budget_categories_system_idx
  ON role_room_budget_categories (is_system) WHERE is_system = TRUE;

-- Idempotent system-seed: kjør kun hvis ingen system-rader finnes enda.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM role_room_budget_categories WHERE is_system = TRUE) THEN
    INSERT INTO role_room_budget_categories
      (parent_group, parent_group_label, category_name, sort_order, is_system)
    VALUES
      -- Above-the-line
      ('ATL', 'Above-the-line', 'Manus & rettigheter', 100, TRUE),
      ('ATL', 'Above-the-line', 'Regi-honorar', 110, TRUE),
      ('ATL', 'Above-the-line', 'Produsent-honorar', 120, TRUE),
      ('ATL', 'Above-the-line', 'Hovedcast', 130, TRUE),
      -- Pre-produksjon
      ('PRE', 'Pre-produksjon', 'Casting', 200, TRUE),
      ('PRE', 'Pre-produksjon', 'Location scouting', 210, TRUE),
      ('PRE', 'Pre-produksjon', 'Storyboard', 220, TRUE),
      ('PRE', 'Pre-produksjon', 'Manus-finalisering', 230, TRUE),
      -- Produksjon (departemental)
      ('PROD', 'Produksjon', 'Kamera', 300, TRUE),
      ('PROD', 'Produksjon', 'Lyd', 310, TRUE),
      ('PROD', 'Produksjon', 'Lys / Grip', 320, TRUE),
      ('PROD', 'Produksjon', 'Art / Scenografi', 330, TRUE),
      ('PROD', 'Produksjon', 'Kostyme', 340, TRUE),
      ('PROD', 'Produksjon', 'Maske', 350, TRUE),
      ('PROD', 'Produksjon', 'SFX / Stunt', 360, TRUE),
      ('PROD', 'Produksjon', 'Locations & permits', 370, TRUE),
      -- Logistikk
      ('LOG', 'Logistikk', 'Reise & overnatting', 400, TRUE),
      ('LOG', 'Logistikk', 'Transport / frakt', 410, TRUE),
      ('LOG', 'Logistikk', 'Catering', 420, TRUE),
      ('LOG', 'Logistikk', 'Sikkerhet', 430, TRUE),
      -- Post-produksjon
      ('POST', 'Post-produksjon', 'Klipp', 500, TRUE),
      ('POST', 'Post-produksjon', 'Lyd-design', 510, TRUE),
      ('POST', 'Post-produksjon', 'VFX', 520, TRUE),
      ('POST', 'Post-produksjon', 'Color / DI', 530, TRUE),
      ('POST', 'Post-produksjon', 'Musikk', 540, TRUE),
      ('POST', 'Post-produksjon', 'Lisensering', 550, TRUE),
      -- Overhead
      ('OH', 'Overhead', 'Forsikring', 600, TRUE),
      ('OH', 'Overhead', 'Juridisk', 610, TRUE),
      ('OH', 'Overhead', 'Bokføring & revisjon', 620, TRUE),
      ('OH', 'Overhead', 'Kontingens', 630, TRUE);
  END IF;
END $$;
