-- 0101_wedding_event_equipment.sql
-- Kobler wedding-timeline-events til user_equipment (Slice 9X.19) istedenfor
-- separate lens-notes-tekstfelt. Stine velger fra utstyret hun allerede har
-- registrert (Canon R5, RF 24-70 f/2.8, Profoto A10) per event.
--
-- equipment_ids er INTEGER[] siden user_equipment.id er serial.
-- PRIVAT — vises ikke til klient.

ALTER TABLE wedding_timeline_events
  ADD COLUMN IF NOT EXISTS equipment_ids INTEGER[] DEFAULT '{}';

COMMENT ON COLUMN wedding_timeline_events.equipment_ids IS
  'Array av user_equipment.id som planlegges brukt på event. PRIVAT.';
