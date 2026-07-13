-- 0394_profession_types_icon_color — retter skjemadrift i profession_types.
--
-- Drizzle-skjemaet (frontend/shared/schema*.ts) definerer `icon_color varchar(7)
-- DEFAULT '#ff8c00'`, og `upsertProfession` (backend/server/admin-misc-routes.ts)
-- INSERT-er/oppdaterer BÅDE `icon_color` OG `updated_at`. Prod-tabellen manglet
-- begge kolonnene → admin «opprett/rediger profesjon» returnerte 500 (lese-stien
-- overlevde via canonical-fallback, så driften var usynlig). Dette blokkerte også
-- seed-migrasjonen 0368_profession_types_seed (refererer icon_color).
--
-- Idempotent (ADD COLUMN IF NOT EXISTS) — trygt å kjøre på enhver eksisterende DB.

ALTER TABLE profession_types
  ADD COLUMN IF NOT EXISTS icon_color varchar(7)  DEFAULT '#ff8c00';

ALTER TABLE profession_types
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
