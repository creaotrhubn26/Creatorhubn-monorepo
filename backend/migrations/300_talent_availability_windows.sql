-- 300_talent_availability_windows.sql
-- The Role Room Talents: rikere tilgjengelighet på talent-profilen.
--
-- Kontekst: talenter (migrasjon 209) hadde kun en grov `availability_status`
-- (open|limited|unavailable) + fritekst `availability_notes`. Dette er en
-- marketplace-signal, ikke en produksjonskalender — og skal ALLTID være
-- samtykke-gated (scope 'availability' i talent_consent_registry) og
-- byrå/talent-eid. Vi utvider signalet med:
--
--   1. availability_windows  — konkrete åpne/begrensede datovinduer, slik at
--      produsenter ser NÅR talenten er ledig (ikke bare en enum). JSONB-array av
--      { status: 'open'|'limited', startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', notes?: string }.
--   2. availability_confirmed_at — ferskhets-stempel: når talenten sist bekreftet
--      tilgjengeligheten sin, slik at produsenter kan stole på signalet (og vi
--      kan nudge stale profiler til å re-bekrefte).
--
-- Alt lever på `talents` — ingen crew/kandidat-kobling. Idempotent.

ALTER TABLE talents
  ADD COLUMN IF NOT EXISTS availability_windows JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE talents
  ADD COLUMN IF NOT EXISTS availability_confirmed_at TIMESTAMPTZ;

-- Backfill: eksisterende profiler med en satt status regnes som «bekreftet»
-- ved sist profil-oppdatering, så de ikke umiddelbart vises som utdaterte.
UPDATE talents
   SET availability_confirmed_at = updated_at
 WHERE availability_confirmed_at IS NULL
   AND availability_status IS NOT NULL;
