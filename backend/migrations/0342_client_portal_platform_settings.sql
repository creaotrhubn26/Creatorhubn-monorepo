-- =====================================================================
-- 0342_client_portal_platform_settings.sql
--
-- Produsent-styrt synlighet for «Koblede kontoer» i klientportalen.
-- Produsenten velger hvilke plattformer klienten ser/kan koble. Lagrer de
-- SKJULTE plattformene (fravær = vis alt unntatt standard-skjulte).
--
-- Google Workspace skjules som standard (sjelden relevant for klient-
-- selvbetjening). En plattform som faktisk ER koblet vises uansett i
-- backend-logikken, så klienten aldri mister en aktiv kobling visuelt.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS role_room_client_portal_settings (
  project_id       VARCHAR(255) PRIMARY KEY,
  hidden_platforms JSONB NOT NULL DEFAULT '["google"]'::jsonb,
  updated_by       VARCHAR(255),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE role_room_client_portal_settings IS
  'Per-prosjekt klientportal-innstillinger. hidden_platforms = plattform-nøkler produsenten har skjult i «Koblede kontoer».';

COMMIT;
