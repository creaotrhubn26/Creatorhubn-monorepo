-- Slice 9X.70 — Admin-styrt marketplace
--
-- Lagring av all marketplace-app-konfig (priser, tiers, bilder, beskrivelser)
-- slik at Daniel kan oppdatere alt fra admin-dashboardet uten kode-deploy.

CREATE TABLE IF NOT EXISTS marketplace_app_config (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT,
  description     TEXT,
  long_description TEXT,
  logo_src        TEXT,
  logo_alt        TEXT,
  gradient_start  TEXT,
  gradient_end    TEXT,
  featured        BOOLEAN DEFAULT FALSE,
  trending        BOOLEAN DEFAULT FALSE,
  cta_label       TEXT,
  rating          NUMERIC(3,2),
  reviews_count   INT,
  download_count  INT,
  monthly_growth  INT,
  pricing         JSONB,
  subscription_tiers JSONB,
  features        JSONB,
  media_gallery   JSONB,
  partner_logos   JSONB,
  display_order   INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      TEXT
);

CREATE INDEX IF NOT EXISTS idx_marketplace_app_config_active
  ON marketplace_app_config (is_active, display_order);

-- Idempotent kolonne-tilføyninger (i tilfelle tabellen finnes fra før)
DO $$ BEGIN
  ALTER TABLE marketplace_app_config ADD COLUMN IF NOT EXISTS subscription_tiers JSONB;
  ALTER TABLE marketplace_app_config ADD COLUMN IF NOT EXISTS media_gallery JSONB;
  ALTER TABLE marketplace_app_config ADD COLUMN IF NOT EXISTS partner_logos JSONB;
  ALTER TABLE marketplace_app_config ADD COLUMN IF NOT EXISTS logo_src TEXT;
  ALTER TABLE marketplace_app_config ADD COLUMN IF NOT EXISTS logo_alt TEXT;
END $$;
