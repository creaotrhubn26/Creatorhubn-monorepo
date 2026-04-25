-- 0060_dance_choreography_project_id.sql
-- Prosjekt-scoping for dans-koreografier.
--
-- Lar en koreografi knyttes til et CreatorHub-prosjekt. Pure additivt:
-- eksisterende rader får NULL project_id og fortsetter å fungere som
-- "frie" koreografier (synlige uten prosjekt-filter).
--
-- Filter-strategi i `listChoreographies`:
--   * uten projectId-filter  → alle for owner
--   * med projectId-filter   → rader der project_id = $filter ELLER project_id IS NULL
--                              (slik at "frie" koreografier alltid følger med)
--
-- VIKTIG: project_id er TEXT (ikke UUID) — dette matcher CreatorHub sin
-- nåværende prosjekt-modell som ikke garanterer UUID-format. Når den
-- modellen strammes inn senere kan vi migrere kolonnen.

ALTER TABLE dance_choreography
  ADD COLUMN IF NOT EXISTS project_id TEXT;

CREATE INDEX IF NOT EXISTS dance_choreography_project_idx
  ON dance_choreography (project_id);
