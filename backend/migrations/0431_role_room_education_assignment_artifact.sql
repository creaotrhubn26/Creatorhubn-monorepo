-- 0431_role_room_education_assignment_artifact.sql
--
-- Tettere kobling oppgave ↔ produksjons-artefakt: en oppgave kan peke på en
-- konkret produksjonsfane/artefakt (f.eks. story-arc, storyboard, call sheet,
-- levering). Da åpner «Åpne produksjon» rett i riktig fane, og leveransen ER
-- artefakten i det ekte prosjektet i stedet for en løs lenke.
--
-- Verdi = en fane-nøkkel fra produksjonsverktøyene (studioAccessModel STUDIO_TABS),
-- f.eks. 'story-arc' | 'storyboard' | 'callsheet' | 'delivery' | 'shotlist'.
-- NULL = fri leveranse (som før).

ALTER TABLE role_room_education_assignments
  ADD COLUMN IF NOT EXISTS artifact_kind TEXT;
