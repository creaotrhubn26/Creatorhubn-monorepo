-- Slice 9X.86 — Threading/replies på video_timecode_comments
--
-- Tillater Bjarne å svare på klient-kommentar i samme tråd, slik at
-- klient ser "Bjarne: 'Fikset i versjon 2'" rett under sin egen
-- kommentar. parent_id NULL = topp-nivå-kommentar (Frame.io-stil).
--
-- author_kind sier hvem som skrev: 'client' (default) eller 'photographer'.
-- Brukes til styling i UI (klient-bobler vs. produsent-bobler).
--
-- ON DELETE CASCADE: hvis topp-nivå slettes går hele tråden med.

ALTER TABLE video_timecode_comments
  ADD COLUMN IF NOT EXISTS parent_id UUID
    REFERENCES video_timecode_comments(id) ON DELETE CASCADE;
ALTER TABLE video_timecode_comments
  ADD COLUMN IF NOT EXISTS author_kind VARCHAR(20) NOT NULL DEFAULT 'client';

CREATE INDEX IF NOT EXISTS idx_video_timecode_comments_parent
  ON video_timecode_comments (parent_id);
