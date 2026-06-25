-- =====================================================================
-- 0337_tiktok_connections_project_scope.sql
--
-- Lar en KLIENT (via klientportalen) koble SIN egen TikTok-konto scopet til
-- et prosjekt, uten å overskrive produsentens globale tilkobling.
--
-- Tidligere var role_room_tiktok_connections UNIQUE(user_id) — kun én
-- tilkobling per bruker. Klient-tilkoblinger lagres under produsentens user_id
-- + project_id (samme mønster som Instagram). Vi bytter derfor til en
-- (user_id, COALESCE(project_id,''))-unik så produsentens globale rad
-- (project_id IS NULL) og klientens prosjekt-rad sameksisterer.
--
-- VIKTIG: produsentens publiserings-/status-lesere pinnes til
-- `project_id IS NULL` i koden (getTikTokConnection), så de aldri plukker
-- klientens rad.
-- =====================================================================

BEGIN;

ALTER TABLE role_room_tiktok_connections
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);

-- Bytt (user_id)-unik → (user_id, COALESCE(project_id,'')).
DROP INDEX IF EXISTS idx_rr_tiktok_connections_user_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_tiktok_user_project_unique
  ON role_room_tiktok_connections (user_id, COALESCE(project_id, ''));

-- open_id-unik må også prosjekt-utvides, ellers blokkerer den at samme
-- TikTok-konto finnes som både produsent-global og klient-prosjekt-rad.
DROP INDEX IF EXISTS idx_rr_tiktok_connections_open_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_tiktok_open_id_project_unique
  ON role_room_tiktok_connections (tiktok_open_id, COALESCE(project_id, ''));

-- Raskt klientportal-oppslag på prosjekt.
CREATE INDEX IF NOT EXISTS idx_rr_tiktok_project
  ON role_room_tiktok_connections (project_id)
  WHERE project_id IS NOT NULL;

COMMIT;
