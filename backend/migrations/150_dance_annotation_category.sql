-- 150_dance_annotation_category.sql
-- Legger til movement-kategori + AI-confidence på dance_video_annotation
-- for DanceAnnotate-paritet (multi-track timeline).
--
--   category   : kort streng som matcher danceMovementCategories.ts
--                ('steps' | 'arms' | 'body' | 'jumps' | 'turns'). Null tillatt
--                for ukategoriserte/legacy-annotasjoner.
--   confidence : 0.00–1.00. Brukes til AI-foreslåtte annotasjoner. Null for
--                manuelt opprettede.
--
-- Frontend tolerer null på begge feltene (se VideoAnnotation-typen og
-- AnnotationTimeline.tsx — uncat-track renderer null-kategori).

ALTER TABLE dance_video_annotation
  ADD COLUMN IF NOT EXISTS category   VARCHAR(40),
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(4,3);

ALTER TABLE dance_video_annotation
  ADD CONSTRAINT IF NOT EXISTS dance_video_annotation_category_values
  CHECK (category IS NULL OR category IN ('steps','arms','body','jumps','turns'));

ALTER TABLE dance_video_annotation
  ADD CONSTRAINT IF NOT EXISTS dance_video_annotation_confidence_range
  CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));

-- Indeks for kategori-filtrering på timeline (clip + kategori + tid).
CREATE INDEX IF NOT EXISTS dance_video_annotation_clip_category_time_idx
  ON dance_video_annotation (clip_id, category, timestamp_sec ASC);
