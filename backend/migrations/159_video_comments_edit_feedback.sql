-- Slice 9X.82 — Edit-feedback-system for video/audio-kommentarer
--
-- Utvider video_timecode_comments fra "punkt-kommentar" til full
-- edit-feedback-workflow som matcher Frame.io / Filepass / Wipster:
--
--   end_timecode_sec  → range-kommentar fra A til B (NULL = punkt)
--   category          → color / audio / edit / vfx / structure / other
--   priority          → must-fix / nice-to-have / suggestion
--
-- Tabellen brukes for både video (CinematicVideoPlayer) og audio
-- (CinematicAudioPlayer) — navnet "video_timecode_comments" beholdes
-- for bakoverkompatibilitet, men logikken er medium-agnostisk.

ALTER TABLE video_timecode_comments
  ADD COLUMN IF NOT EXISTS end_timecode_sec NUMERIC(10,3);

ALTER TABLE video_timecode_comments
  ADD COLUMN IF NOT EXISTS category VARCHAR(32) DEFAULT 'other';

ALTER TABLE video_timecode_comments
  ADD COLUMN IF NOT EXISTS priority VARCHAR(16) DEFAULT 'suggestion';

-- Validere enums via CHECK constraints (drop-then-create slik at det er idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'video_timecode_comments_category_check') THEN
    ALTER TABLE video_timecode_comments DROP CONSTRAINT video_timecode_comments_category_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'video_timecode_comments_priority_check') THEN
    ALTER TABLE video_timecode_comments DROP CONSTRAINT video_timecode_comments_priority_check;
  END IF;
END $$;

ALTER TABLE video_timecode_comments
  ADD CONSTRAINT video_timecode_comments_category_check
  CHECK (category IN ('color', 'audio', 'edit', 'vfx', 'structure', 'text', 'other'));

ALTER TABLE video_timecode_comments
  ADD CONSTRAINT video_timecode_comments_priority_check
  CHECK (priority IN ('must-fix', 'nice-to-have', 'suggestion'));

CREATE INDEX IF NOT EXISTS idx_video_comments_category
  ON video_timecode_comments (gallery_id, category);
CREATE INDEX IF NOT EXISTS idx_video_comments_priority
  ON video_timecode_comments (gallery_id, priority);
