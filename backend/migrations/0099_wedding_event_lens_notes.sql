-- 0099_wedding_event_lens_notes.sql
-- Linse-spesifikke noter per timeline-event. Skilles fra photo_notes
-- (komposisjon/lyssetting) så Stine kan planlegge linse-valg distinkt:
--   photo_notes: "Hold avstand under prosesjonen, fang reaksjoner"
--   lens_notes:  "24-70mm for wide, bytte til 85mm f/1.4 ved ring-bytte"
--
-- Begge er PRIVAT — vises aldri til brudeparet. Serialisering på client-side
-- (lookupWeddingIdByToken-flyten) ekskluderer eksplisitt begge.

ALTER TABLE wedding_timeline_events
  ADD COLUMN IF NOT EXISTS lens_notes TEXT;

COMMENT ON COLUMN wedding_timeline_events.lens_notes IS
  'Privat linse-planlegging per event (f.eks. "24-70mm + 85mm f/1.4"). Vises ALDRI til klient.';
