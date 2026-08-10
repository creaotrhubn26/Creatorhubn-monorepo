-- 0462_role_room_production_day_data.sql
--
-- `casting_production_days.data` ble til nå lagt til ved oppstart av
-- casting-production-routes.ts (`ensureSchema`), ikke i en migrering. Det
-- fungerte så lenge bare den filen leste kolonnen.
--
-- AML-sjekken (Del A punkt 74/80) trenger dagens `callTime`/`wrapTime`, som
-- ligger nettopp der. En kolonne som først finnes etter at en annen modul
-- tilfeldigvis har kjørt, er ikke noe å bygge en etterlevelsessjekk på —
-- rekkefølgen er ikke garantert, og feilen ville vist seg som «ingen vakter»
-- framfor som en feil.
--
-- Kolonnen defineres derfor her. `ensureSchema` kan bli stående; begge er
-- idempotente og beskriver det samme.

ALTER TABLE casting_production_days
  ADD COLUMN IF NOT EXISTS data JSONB;

COMMENT ON COLUMN casting_production_days.data IS
  'Hele produksjonsdag-objektet fra frontend. Inneholder blant annet callTime/wrapTime, som AML-sjekken leser.';

ALTER TABLE casting_props
  ADD COLUMN IF NOT EXISTS data JSONB;
