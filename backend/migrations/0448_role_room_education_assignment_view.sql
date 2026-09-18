-- 0448_role_room_education_assignment_view.sql
--
-- Sub-view innenfor artifact_kind sin fane (f.eks. artifact_kind='story-arc' +
-- artifact_view='story-logic'). artifact_kind (fane-nøkkel, RBAC) er UENDRET —
-- dette er additivt: en valgfri, mer presis peker INNI fanen. NULL = fanens
-- forvalgte visning (som før).

ALTER TABLE role_room_education_assignments
  ADD COLUMN IF NOT EXISTS artifact_view TEXT;
