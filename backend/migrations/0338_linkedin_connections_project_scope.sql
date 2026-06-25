-- =====================================================================
-- 0338_linkedin_connections_project_scope.sql
--
-- Del 2 av 2 (etter 0337 TikTok): lar en KLIENT koble SIN egen LinkedIn-konto
-- scopet til et prosjekt i klientportalen, uten å overskrive produsentens
-- globale tilkobling (som brukes til publisering).
--
-- Produsentens egne tilkoblinger: project_id = null (global).
-- Klient-portal-tilkoblinger: project_id = <prosjekt> (lagres under produsentens
-- user_id, men prosjekt-scopet). Produsentens publiserings-/status-lesere
-- pinnes til `project_id IS NULL` i koden.
-- =====================================================================

BEGIN;

ALTER TABLE role_room_linkedin_connections
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);

-- (user_id) → (user_id, COALESCE(project_id,'')) så global + prosjekt-rad sameksisterer.
DROP INDEX IF EXISTS idx_rr_linkedin_connections_user_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_linkedin_user_project_unique
  ON role_room_linkedin_connections (user_id, COALESCE(project_id, ''));

-- member_id-unik må prosjekt-utvides, ellers blokkerer den samme LinkedIn-konto
-- som både produsent-global og klient-prosjekt-rad.
DROP INDEX IF EXISTS idx_rr_linkedin_connections_member_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_linkedin_member_project_unique
  ON role_room_linkedin_connections (linkedin_member_id, COALESCE(project_id, ''));

CREATE INDEX IF NOT EXISTS idx_rr_linkedin_project
  ON role_room_linkedin_connections (project_id)
  WHERE project_id IS NOT NULL;

COMMIT;
