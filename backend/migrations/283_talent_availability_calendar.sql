-- 0154_talent_availability_calendar.sql
-- Per-dag tilgjengelighet for talenter (Talents "Tilgjengelighet"-kalender).
-- talents (mig 209) hadde kun availability_status (én enum) + notes. Dette
-- legger til en JSONB-kalender: dato → { status, note? }.
--
-- Form: { "2026-10-14": { "status": "available" },
--         "2026-10-15": { "status": "busy", "note": "Opptak" } }
-- status ∈ 'available' | 'busy'. Fraværende dato = ukjent (nøytral).
-- JSONB holder det enkelt (én rad per talent); ingen egen tabell trengs for v1.

ALTER TABLE talents
  ADD COLUMN IF NOT EXISTS availability_calendar JSONB NOT NULL DEFAULT '{}'::jsonb;
