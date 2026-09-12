-- =====================================================================
-- 316_leadgrid_route_user_varchar.sql
--
-- Fiks: lead_routes.user_id ble deklarert UUID i mig 313, men bruker-IDer
-- i systemet er VARCHAR(255) (jf. users.id, organization_members.user_id).
-- Ingen route-endepunkter har eksistert enda, så tabellen er tom — trygt å
-- endre typen. Uten dette ville INSERT av en ikke-UUID bruker-ID feile.
--
-- Idempotent: endrer kun hvis kolonnen fortsatt er uuid.
-- =====================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'lead_routes' AND column_name = 'user_id'
       AND data_type = 'uuid'
  ) THEN
    ALTER TABLE lead_routes ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lead_routes_user_date
  ON lead_routes (user_id, planned_date DESC);

COMMIT;
