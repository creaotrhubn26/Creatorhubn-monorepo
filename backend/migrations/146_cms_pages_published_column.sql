-- Migration 146: cms_pages_published_column
--
-- Render-log avslørte at "column 'published' does not exist" — som
-- betyr at en TIDLIGERE versjon av 141 ble kjørt på prod FØR vi la
-- til `published`-kolonnen i CREATE TABLE. migrate.sh markerte 141
-- som "applied" basert på filnavn, så den senere-utvidede 141 kjørte
-- aldri på nytt.
--
-- Denne migrasjonen sikrer at ALLE kolonner som dagens kode forventer
-- faktisk finnes i tabellen — idempotent (IF NOT EXISTS), trygt å
-- kjøre på enhver eksisterende cms_pages-tabell.

ALTER TABLE IF EXISTS cms_pages
  ADD COLUMN IF NOT EXISTS variant         varchar(32) NOT NULL DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS content         jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at      timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by      varchar,
  ADD COLUMN IF NOT EXISTS updated_by      varchar,
  ADD COLUMN IF NOT EXISTS publish_at      timestamptz,
  ADD COLUMN IF NOT EXISTS unpublish_at    timestamptz;

-- Sikre indeksene også (har kanskje ikke kjørt før)
CREATE INDEX IF NOT EXISTS cms_pages_variant_idx ON cms_pages (variant);
CREATE INDEX IF NOT EXISTS cms_pages_published_idx ON cms_pages (published);
