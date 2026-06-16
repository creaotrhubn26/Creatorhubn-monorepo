-- 287_role_room_ad_audience.sql
-- Agent «Annonse-målgruppe»: AI-estimert målgruppe («hvem annonsen treffer»)
-- per prosjekt/plattform. Det finnes ingen ekte Meta-delivery-insights-kilde
-- ennå, så dette er Claude-estimert fra firmaprofil — tydelig merket. Soft-refs.

CREATE TABLE IF NOT EXISTS role_room_ad_audience (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   TEXT,
  project_id      TEXT NOT NULL,
  platform        TEXT NOT NULL DEFAULT 'meta',
  audience_name   TEXT,
  estimated_reach INTEGER,
  ages            JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{lbl,pct}]
  female_pct      INTEGER,
  locations       JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{name,pct}]
  interests       JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{t,hot}]
  source          TEXT,                                  -- claude | template
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_room_ad_audience_scope
  ON role_room_ad_audience (project_id, platform, created_at DESC);
