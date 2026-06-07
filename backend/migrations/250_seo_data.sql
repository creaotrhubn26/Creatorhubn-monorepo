-- Migration 250 — SEO data tabeller.
--
-- Backes UI-fanen Admin → Marketing → SEO Dashboard
-- (frontend/client/src/components/marketing/MarketingSEODashboard.tsx).
--
-- Tre core-tabeller: keywords, pages, backlinks. Seedet med 5 demo-
-- keywords slik at dashboardet ikke virker dødt rett etter migrasjon.
--
-- Idempotent — tabellene kan allerede finnes fra tidligere SEO-arbeid
-- med litt annet skjema; vi legger til kolonner som mangler.

-- ─── seo_keywords ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  search_volume INTEGER,
  difficulty INTEGER, -- 0-100
  intent TEXT, -- 'informational' | 'transactional' | 'navigational'
  current_position INTEGER,
  target_url TEXT,
  tracked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE seo_keywords ADD COLUMN IF NOT EXISTS search_volume INTEGER;
ALTER TABLE seo_keywords ADD COLUMN IF NOT EXISTS difficulty INTEGER;
ALTER TABLE seo_keywords ADD COLUMN IF NOT EXISTS intent TEXT;
ALTER TABLE seo_keywords ADD COLUMN IF NOT EXISTS current_position INTEGER;
ALTER TABLE seo_keywords ADD COLUMN IF NOT EXISTS target_url TEXT;
ALTER TABLE seo_keywords ADD COLUMN IF NOT EXISTS tracked_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Eldre versjon hadde campaign_id NOT NULL — relax så standalone-seed går igjennom.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='seo_keywords' AND column_name='campaign_id'
  ) THEN
    EXECUTE 'ALTER TABLE seo_keywords ALTER COLUMN campaign_id DROP NOT NULL';
  END IF;
END $$;

-- Unik på keyword. Bruk DO-blokk så vi tåler dupes i eksisterende data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seo_keywords_keyword_key'
  ) THEN
    BEGIN
      ALTER TABLE seo_keywords ADD CONSTRAINT seo_keywords_keyword_key UNIQUE (keyword);
    EXCEPTION WHEN unique_violation THEN
      -- Eksisterende dupes — hopp over constraint i denne migrasjonen.
      RAISE NOTICE 'seo_keywords har dupes — UNIQUE-constraint hoppet over';
    END;
  END IF;
END $$;

-- ─── seo_pages ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  title TEXT,
  meta_description TEXT,
  word_count INTEGER,
  has_schema BOOLEAN DEFAULT FALSE,
  last_crawled_at TIMESTAMPTZ,
  pagespeed_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE seo_pages ADD COLUMN IF NOT EXISTS word_count INTEGER;
ALTER TABLE seo_pages ADD COLUMN IF NOT EXISTS has_schema BOOLEAN DEFAULT FALSE;
ALTER TABLE seo_pages ADD COLUMN IF NOT EXISTS last_crawled_at TIMESTAMPTZ;
ALTER TABLE seo_pages ADD COLUMN IF NOT EXISTS pagespeed_score INTEGER;
ALTER TABLE seo_pages ADD COLUMN IF NOT EXISTS meta_description TEXT;

-- ─── seo_backlinks ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_backlinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  anchor_text TEXT,
  domain_authority INTEGER,
  is_followed BOOLEAN DEFAULT TRUE,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE seo_backlinks ADD COLUMN IF NOT EXISTS domain_authority INTEGER;
ALTER TABLE seo_backlinks ADD COLUMN IF NOT EXISTS is_followed BOOLEAN DEFAULT TRUE;
ALTER TABLE seo_backlinks ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─── Indekser ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS seo_keywords_position_idx ON seo_keywords (current_position);
CREATE INDEX IF NOT EXISTS seo_backlinks_target_idx ON seo_backlinks (target_url);

-- ─── Seed 5 demo-keywords ───────────────────────────────────────
-- Idempotent via ON CONFLICT på keyword. Hvis UNIQUE-constraint feilet
-- over (eksisterende dupes), gjør vi en defensiv NOT EXISTS-sjekk.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seo_keywords_keyword_key'
  ) THEN
    INSERT INTO seo_keywords (keyword, search_volume, difficulty, current_position) VALUES
      ('fotograf bryllup oslo', 1200, 65, 12),
      ('videograf bedrift norge', 480, 45, 8),
      ('castingbyrå norge', 280, 35, 5),
      ('event-fotograf priser', 320, 40, 15),
      ('drone fotograf oslo', 590, 55, 22)
    ON CONFLICT (keyword) DO NOTHING;
  ELSE
    INSERT INTO seo_keywords (keyword, search_volume, difficulty, current_position)
    SELECT v.keyword, v.search_volume, v.difficulty, v.current_position
      FROM (VALUES
        ('fotograf bryllup oslo', 1200, 65, 12),
        ('videograf bedrift norge', 480, 45, 8),
        ('castingbyrå norge', 280, 35, 5),
        ('event-fotograf priser', 320, 40, 15),
        ('drone fotograf oslo', 590, 55, 22)
      ) AS v(keyword, search_volume, difficulty, current_position)
     WHERE NOT EXISTS (
       SELECT 1 FROM seo_keywords k WHERE k.keyword = v.keyword
     );
  END IF;
END $$;
