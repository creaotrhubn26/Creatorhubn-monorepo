-- Idempotent backfill — sørger for at users-tabellen har profession +
-- company_name selv på databaser hvor 0001_loose_kulan_gath.sql aldri
-- ble kjørt til slutten. Symptom som triggert denne migrasjonen:
--   /api/post-agent/me returnerte HTTP 500 med
--   `column "profession" does not exist` (2026-05-30).
-- Mange handlers (admin-room-role-room-economy-routes, admin-dashboard-
-- routes, admin-provisioning-routes, post-agent-anthropic-routes /me)
-- antar at disse kolonnene finnes.

ALTER TABLE users ADD COLUMN IF NOT EXISTS profession varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name varchar;
