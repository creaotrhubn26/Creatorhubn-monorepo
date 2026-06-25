-- =====================================================================
-- 0339_client_google_connections.sql
--
-- Klient-portal Google-tilkoblinger i EGEN tabell (ikke role_room_google_-
-- connections). Bevisst isolert fordi produsentens Google-tilkobling leses av
-- 20+ Workspace-integrasjoner (Meet/Calendar/Gmail/Drive/kontrakter) + en
-- destruktiv DELETE i upsert-en — in-place project-scoping der er for risikabelt.
--
-- Én klient-Google-tilkobling per prosjekt (UNIQUE(project_id)). Lagres med
-- produsentens user_id som referanse, men leses ALDRI av de eksisterende
-- Workspace-leserne.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS role_room_client_google_connections (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              VARCHAR(255) NOT NULL,
  producer_user_id        VARCHAR(255) NOT NULL,
  google_email            VARCHAR(320),
  google_subject          VARCHAR(255),
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
  CONSTRAINT role_room_client_google_unique_project UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_rr_client_google_project
  ON role_room_client_google_connections (project_id);

COMMIT;
