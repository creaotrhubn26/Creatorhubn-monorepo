-- 0371: users.meta jsonb-kolonne (2026-07-08)
--
-- Pattern-audit (Notification-QA-oppfølging) avdekket at FIRE flyter
-- skriver til `users.meta` som IKKE fantes → hver query kastet
-- «column "meta" does not exist» → uhåndtert → HENG/500:
--   - org-self-onboard (magic_token ved ny-bruker-signup)
--   - superadmin create-org (invite_token-fallback)
--   - testflight-testers (tester-metadata)
--   - user-org /api/users/me/active-org (aktiv-org-valg)
--
-- organizations.meta finnes allerede; dette er users-motstykket.
-- Nullable jsonb default '{}' — bakoverkompatibelt, ingen backfill nødvendig.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;
