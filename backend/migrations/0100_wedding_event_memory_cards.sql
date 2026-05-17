-- 0100_wedding_event_memory_cards.sql
-- Minnekort brukt under hver event. Stine kan tagge "CFexpress #1 (256GB)"
-- og "SD #2 (128GB)" på et event når hun skyter med to bodies samtidig.
-- Brukes til backup-tracking ("hvilke kort må til Drive etter dagen?") og
-- recovery hvis et kort skulle feile.
--
-- PRIVAT — vises aldri til brudeparet (samme som photo_notes/lens_notes).

ALTER TABLE wedding_timeline_events
  ADD COLUMN IF NOT EXISTS memory_cards TEXT[] DEFAULT '{}';

COMMENT ON COLUMN wedding_timeline_events.memory_cards IS
  'Array med minnekort brukt under event (free-form labels). PRIVAT — vises ikke til klient.';
