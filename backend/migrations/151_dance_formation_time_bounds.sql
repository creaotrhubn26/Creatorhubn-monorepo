-- 151_dance_formation_time_bounds.sql
-- DanceFlow-paritet: tids-bundne formasjoner.
--
-- Legger til:
--   start_sec / end_sec : når på koreografiens tidslinje denne formasjonen
--                         er aktiv. Begge nullable inntil koreografen
--                         eksplisitt plasserer dem på timelinen.
--   tags                : jsonb-array av string-tagger (Opening, V-Shape, ...)
--                         brukt til filter + visuell gruppering.
--   transition_note     : kort tekst om hvordan overgangen FRA forrige
--                         formasjon skal gjøres ("D2 og D4 krysser").
--
-- Frontend (FormationView + FormationTimeline) leser feltene defensivt;
-- null/manglende verdier gir samme oppførsel som før migrasjonen.

ALTER TABLE dance_formation
  ADD COLUMN IF NOT EXISTS start_sec        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS end_sec          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS tags             JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS transition_note  TEXT;

ALTER TABLE dance_formation
  ADD CONSTRAINT IF NOT EXISTS dance_formation_time_bounds_order
  CHECK (start_sec IS NULL OR end_sec IS NULL OR end_sec >= start_sec);

-- Hot path: list per (owner, project) sortert etter start_sec for
-- timeline-rendering. NULLS LAST slik at u-plasserte formasjoner
-- havner til slutt.
CREATE INDEX IF NOT EXISTS dance_formation_owner_project_time_idx
  ON dance_formation (owner_user_id, project_id, start_sec NULLS LAST, display_order);
