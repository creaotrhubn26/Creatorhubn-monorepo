-- 226_competitor_account_type.sql
--
-- Utvider marketing_competitor_pages med account_type så vi kan tracke
-- både Facebook Pages OG Instagram Business-kontoer som konkurrenter.
--
-- For IG-rader brukes page_id-feltet til å lagre IG Business user_id.
-- account_type='facebook' (default) → eksisterende FB-flyt
-- account_type='instagram'         → bruk business_discovery via vår IG-kaller
--
-- Idempotent.

ALTER TABLE marketing_competitor_pages
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'facebook';

-- IG-konkurrenter trenger også IG-username for å lookup via business_discovery
ALTER TABLE marketing_competitor_pages
  ADD COLUMN IF NOT EXISTS ig_username TEXT;

-- Indeks for filter på type i UI
CREATE INDEX IF NOT EXISTS idx_marketing_competitor_pages_brand_type
  ON marketing_competitor_pages (brand_key, account_type, active);
