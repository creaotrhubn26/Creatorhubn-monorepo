-- 0428_role_room_education_license.sql
--
-- Per-institusjon TRR-lisens (utdannings-workspace). «TRR-seter» = navngitte,
-- aktive Role Room-brukere (faglærere + studenter). En institusjon (owner) har
-- én lisens-rad: enten en navngitt sete-grense (seat_limit) eller ubegrenset
-- (site-/FTE-avtale). Settes ved avtaleinngåelse — ikke self-serve billing.

CREATE TABLE IF NOT EXISTS role_room_education_license (
  owner_user_id  VARCHAR(255) PRIMARY KEY,
  seat_limit     INT,                              -- NULL = ikke satt / ubegrenset
  unlimited      BOOLEAN NOT NULL DEFAULT false,    -- true = site-/FTE-lisens
  model          TEXT NOT NULL DEFAULT 'named',      -- named | site | fte
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
