-- 330_dancer_availability_confirmed_at.sql
-- Dans-vertikalen (The Role Room): ferskhets-stempel på danser-tilgjengelighet.
--
-- Kontekst: `dancer_profile_extras` (mig 0061) har `availability_windows`
-- (JSONB-array av { from, to, note? }). Vinduer settes ofte langt i forveien,
-- så en produsent kan ikke vite om et vindu fortsatt stemmer. Vi legger til
-- et ferskhets-stempel — når danseren sist bekreftet tilgjengeligheten sin —
-- slik at UI kan flagge utdaterte vinduer (>30 dager) og nudge til å
-- re-bekrefte. Speiler mønsteret fra The Role Room Talents
-- (availability_confirmed_at, mig 300).
--
-- Alt lever på `dancer_profile_extras` — owner-scoped, ingen crew-kobling.
-- Idempotent.

ALTER TABLE dancer_profile_extras
  ADD COLUMN IF NOT EXISTS availability_confirmed_at TIMESTAMPTZ;

-- Backfill: eksisterende profiler med satte vinduer regnes som «bekreftet»
-- ved sist profil-oppdatering, så de ikke umiddelbart vises som utdaterte.
UPDATE dancer_profile_extras
   SET availability_confirmed_at = updated_at
 WHERE availability_confirmed_at IS NULL
   AND availability_windows IS NOT NULL
   AND jsonb_array_length(availability_windows) > 0;
