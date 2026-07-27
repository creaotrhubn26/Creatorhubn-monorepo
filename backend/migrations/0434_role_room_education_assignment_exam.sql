-- 0434_role_room_education_assignment_exam.sql
--
-- Marker en oppgave som EKSAMEN / sluttvurdering. Når en eksamenskarakter pushes
-- til Canvas (AGS), håndhever backend at ALLE arbeidskrav i kullet er godkjent
-- i Canvas for studenten først (Canvas = fasit) — den harde eksamens-gaten.

ALTER TABLE role_room_education_assignments
  ADD COLUMN IF NOT EXISTS is_exam BOOLEAN NOT NULL DEFAULT false;
