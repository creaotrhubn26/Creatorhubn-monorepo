-- 0077_casting_manuscript_lock.sql
-- Eksplisitt lås-state på casting_manuscripts. Kolonnen `locked_by` finnes
-- fra før, men ble aldri lest/skrevet av app-koden. Vi legger til
-- tidsstempel og token slik at låsen kan utløpe via TTL og frigis sikkert.
--
-- Service-laget lagrer fortsatt manuskript-blobben i compat-store; disse
-- kolonnene er reservert for fremtidig SQL-først-migrering.

ALTER TABLE casting_manuscripts
  ADD COLUMN IF NOT EXISTS locked_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_token VARCHAR(64);
