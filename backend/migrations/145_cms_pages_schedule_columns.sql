-- Migration 145: cms_pages_schedule_columns
--
-- Migrasjon 141 ble markert "applied" på prod FØR vi la til
-- publish_at/unpublish_at-ALTERs. migrate.sh tracker per filnavn,
-- ikke innhold, så ALTERene kjørte aldri.
--
-- Resultat: /api/cms/pages/:slug returnerer 500 fordi backend-koden
-- forventer publish_at-kolonnen.
--
-- Denne migrasjonen er idempotent (IF NOT EXISTS) og kan kjøres trygt
-- på enhver eksisterende cms_pages-tabell.

ALTER TABLE IF EXISTS cms_pages
  ADD COLUMN IF NOT EXISTS publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS unpublish_at timestamptz;
