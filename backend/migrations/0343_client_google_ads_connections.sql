-- =====================================================================
-- 0343_client_google_ads_connections.sql
--
-- Klient-portal Google ADS-tilkoblinger i EGEN isolert tabell (parallelt til
-- role_room_client_google_connections / mig 0339). Holdes adskilt fra:
--   • role_room_google_connections (Workspace-lesere: Meet/Calendar/Gmail/Drive)
--   • role_room_ads_oauth_connections (produsentens egen MCC-OAuth, user_id-scopet)
--
-- Her kobler KLIENTEN sin egen Google Ads-konto (scope: adwords) per prosjekt,
-- slik at produsenten kan kjøre annonser / opprette konverterings-actions i
-- klientens egen konto. Én tilkobling per prosjekt (UNIQUE(project_id)).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS role_room_client_google_ads_connections (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              VARCHAR(255) NOT NULL,
  producer_user_id        VARCHAR(255) NOT NULL,
  google_email            VARCHAR(320),
  google_subject          VARCHAR(255),
  ads_customer_id         VARCHAR(20),
  access_token_encrypted  TEXT,
  refresh_token_encrypted TEXT,
  expiry_date             TIMESTAMPTZ,
  scopes                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  connection_state        VARCHAR(32) NOT NULL DEFAULT 'connected',
  last_error              TEXT,
  profile                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at            TIMESTAMPTZ,
  CONSTRAINT role_room_client_google_ads_unique_project UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_rr_client_google_ads_project
  ON role_room_client_google_ads_connections (project_id);

COMMIT;
