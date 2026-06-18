-- 273_audio_releases.sql
--
-- Publiseringssystem: en utgivelse (release) fra et godkjent review-rom. Samler
-- metadata + identifikatorer + master-versjon + cover for levering til DSP-er
-- (via release-pakke nå; distributør-API senere). Credits/splitt hentes fra
-- splittarket (split_sheet_contributors).

CREATE TABLE IF NOT EXISTS audio_releases (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id      TEXT NOT NULL,
  review_project_id  UUID REFERENCES audio_review_projects(id) ON DELETE SET NULL,
  easeverse_track_id TEXT,
  title              TEXT NOT NULL,
  primary_artist     TEXT,
  featured_artists   JSONB NOT NULL DEFAULT '[]'::jsonb,
  release_type       TEXT NOT NULL DEFAULT 'single',   -- single | ep | album
  primary_genre      TEXT,
  secondary_genre    TEXT,
  language           TEXT NOT NULL DEFAULT 'no',
  explicit           BOOLEAN NOT NULL DEFAULT FALSE,
  release_date       DATE,
  isrc               TEXT,                              -- per innspilling (master)
  upc                TEXT,                              -- per release (strekkode)
  label              TEXT,
  copyright_year     INTEGER,
  p_line             TEXT,                              -- ℗ (master)
  c_line             TEXT,                              -- © (komposisjon)
  cover_url          TEXT,
  master_version_id  UUID,
  master_url         TEXT,
  -- draft | ready | exported | released
  status             TEXT NOT NULL DEFAULT 'draft',
  exported_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audio_releases_owner ON audio_releases (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_audio_releases_review ON audio_releases (review_project_id);
