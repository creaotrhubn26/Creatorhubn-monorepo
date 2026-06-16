-- 0156_dance_class_level.sql
-- Legger til nivå på dance_class (0068) for klasse-oversikt-kortet
-- (rr-dance-klasser): "Nybegynner" / "Mellomnivå" / "Viderekomne".
-- NULLABLE — eksisterende klasser påvirkes ikke.

ALTER TABLE dance_class
  ADD COLUMN IF NOT EXISTS level TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dance_class_level_values') THEN
    ALTER TABLE dance_class
      ADD CONSTRAINT dance_class_level_values
      CHECK (level IS NULL OR level IN ('nybegynner','mellomniva','viderekomne','alle'));
  END IF;
END $$;
