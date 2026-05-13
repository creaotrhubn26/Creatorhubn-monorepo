-- Migration 141: cms_pages
--
-- Enkel CMS-tabell for SEO-landingssider (student-rettet,
-- konkurrent-sammenligninger, etc.) som administreres fra
-- AdminRoom uten kode-deploy.
--
-- Modell:
--   slug      = identifikator + URL-segment (f.eks. "for-studenter")
--   content   = JSON-payload med page-config (h1, intro, examples, ...)
--   variant   = "student" | "competitor" | "generic" — for filter i UI
--   published = false = utkast, true = live
--
-- Frontend henter med fallback til hardkodet default ved feil:
-- GET /api/cms/pages/:slug returnerer 200 med content eller 404 → frontend faller tilbake til hardkodet content.
--
-- Audit:
--   updated_by lagrer e-post for ansvarlig redaktør, slik at
--   endrings-sporet i AdminRoom-aktivitetsloggen kan vise hvem
--   som endret innholdet.

CREATE TABLE IF NOT EXISTS cms_pages (
  slug            varchar PRIMARY KEY,
  variant         varchar(32) NOT NULL DEFAULT 'generic',
  content         jsonb NOT NULL DEFAULT '{}'::jsonb,
  published       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      varchar
);

CREATE INDEX IF NOT EXISTS cms_pages_variant_idx ON cms_pages (variant);
CREATE INDEX IF NOT EXISTS cms_pages_published_idx ON cms_pages (published);

-- Trigger som auto-oppdaterer updated_at ved hver UPDATE.
CREATE OR REPLACE FUNCTION cms_pages_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cms_pages_updated_at_trigger ON cms_pages;
CREATE TRIGGER cms_pages_updated_at_trigger
  BEFORE UPDATE ON cms_pages
  FOR EACH ROW
  EXECUTE FUNCTION cms_pages_set_updated_at();

-- Schedule-felter for publisering (publish_at = forutbestemt tidspunkt).
-- NULL = ingen schedule, publisert med en gang etter `published=true`.
ALTER TABLE IF EXISTS cms_pages
  ADD COLUMN IF NOT EXISTS publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS unpublish_at timestamptz;

-- Revisions-tabell — hver lagring snapshotter forrige content.
-- Lar AdminRoom rulle tilbake til tidligere versjoner.
CREATE TABLE IF NOT EXISTS cms_page_revisions (
  id              bigserial PRIMARY KEY,
  slug            varchar NOT NULL REFERENCES cms_pages(slug) ON DELETE CASCADE,
  content         jsonb NOT NULL,
  variant         varchar(32) NOT NULL DEFAULT 'generic',
  published       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      varchar
);

CREATE INDEX IF NOT EXISTS cms_page_revisions_slug_idx
  ON cms_page_revisions (slug, created_at DESC);
