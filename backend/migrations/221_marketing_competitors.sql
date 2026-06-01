-- 221_marketing_competitors.sql
--
-- Konkurrent-monitor: tracked-list + daily snapshots.
-- Brukt av Marketing Cockpit til å vise fan_count-trend, post-frekvens,
-- og kategori-shifts over tid for konkurrent-Pages.
--
-- Idempotent: trygt å kjøre flere ganger.

CREATE TABLE IF NOT EXISTS marketing_competitor_pages (
  id               BIGSERIAL PRIMARY KEY,
  brand_key        TEXT NOT NULL,           -- Hvilket brand som tracker (f.eks. "theroleroom")
  page_id          TEXT NOT NULL,           -- FB Page ID
  nickname         TEXT NOT NULL,           -- Kort navn brukt i UI (e.g. "Filmweb")
  category         TEXT,                    -- Kategori (auto-fylt fra første snapshot)
  notes            TEXT,                    -- Manuell kontekst om hvorfor de tracks
  active           BOOLEAN NOT NULL DEFAULT true,
  added_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by         TEXT,                    -- Email på admin som la dem til

  UNIQUE (brand_key, page_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_competitor_pages_brand
  ON marketing_competitor_pages (brand_key, active);

CREATE TABLE IF NOT EXISTS marketing_competitor_snapshots (
  id               BIGSERIAL PRIMARY KEY,
  competitor_id    BIGINT NOT NULL REFERENCES marketing_competitor_pages(id) ON DELETE CASCADE,
  snapshot_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  fan_count        INTEGER,
  name             TEXT,
  category         TEXT,
  website          TEXT,
  about            TEXT,
  -- post-aktivitets-signaler:
  recent_post_count_7d  INTEGER,            -- Antall posts siste 7 dager (ved snapshot-tidspunkt)
  recent_post_count_30d INTEGER,            -- Antall posts siste 30 dager
  -- raw Meta-respons for full audit (JSONB for fleksibilitet):
  raw_profile_json JSONB,
  raw_posts_json   JSONB,
  -- error-tracking:
  fetch_error      TEXT
);

CREATE INDEX IF NOT EXISTS idx_marketing_competitor_snapshots_comp_time
  ON marketing_competitor_snapshots (competitor_id, snapshot_at DESC);

-- Effektivt query for å hente siste snapshot per konkurrent:
CREATE INDEX IF NOT EXISTS idx_marketing_competitor_snapshots_latest
  ON marketing_competitor_snapshots (competitor_id, snapshot_at DESC)
  WHERE fetch_error IS NULL;
