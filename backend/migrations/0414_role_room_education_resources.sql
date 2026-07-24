-- 0414_role_room_education_resources.sql
-- Utdannings-workspace, opplæringslag 3: FAG-BIBLIOTEK.
-- Korte «hvordan»-leksjoner festet til produksjonsstegene (idé/manus, casting,
-- planlegging, opptak, etterarbeid, levering). Faglærer kurerer institusjonens
-- eget bibliotek — lærer FAGET, ikke bare verktøyet. Owner-scopet.

CREATE TABLE IF NOT EXISTS role_room_education_resources (
  id            TEXT PRIMARY KEY,
  owner_user_id VARCHAR(255) NOT NULL,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general', -- idea|casting|planning|shoot|post|delivery|general
  description   TEXT,
  url           TEXT,   -- lenke til video/artikkel
  body          TEXT,   -- valgfri innebygd tekst
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_education_resources_owner
  ON role_room_education_resources (owner_user_id, category, sort_order, created_at DESC);
