-- 216_dance_formation_sections.sql
-- Workflow-audit G26: koreografer trenger å gruppere formasjoner i
-- 'Intro / Vers 1 / Refreng / Vers 2 / Bridge / Outro' når et stykke har
-- 20+ formasjoner. Tidligere var formasjoner en flat liste.
--
-- Strategi: enkelt section_name-felt på dance_formation. Ikke en separat
-- tabell — section er kun et gruppe-label, ingen ekstra metadata. Sortering
-- bevares av display_order; section-navn vises som collapsible headers i UI.
--
-- NULL = ingen seksjon ('Ingen kapittel' i UI). Tom string ekvivalent.
-- Backwards-compat: eksisterende rader får NULL.

ALTER TABLE dance_formation
  ADD COLUMN IF NOT EXISTS section_name TEXT;

-- Hot path: group-by section_name i UI. Ikke et must, men hjelper hvis
-- vi senere bygger /sections/summary-endpoint.
CREATE INDEX IF NOT EXISTS dance_formation_owner_section_idx
  ON dance_formation (owner_user_id, project_id, section_name);
