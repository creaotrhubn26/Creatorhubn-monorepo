-- 0152_dancer_injury_stages.sql
-- Utvider skadeloggen (0062 dancer_injury_log) med eksplisitt rehab-steg
-- og fremdrift, slik at "injuries"-fanen i DanceWorkspace kan vise et
-- 4-stegs rehab-løp (Akutt → Behandling → Opptrening → Retur) med
-- prosent-fremdrift — i stedet for å kun utlede det av status + datoer.
--
-- Begge kolonner er NULLABLE: når de er NULL utleder klienten steg/prosent
-- av status (active/healing/resolved) + entry/expectedReturn-datoer, så
-- eksisterende rader fungerer uendret. Instruktøren kan sette dem manuelt.

ALTER TABLE dancer_injury_log
  -- Rehab-steg: 'acute' (Akutt) | 'treatment' (Behandling)
  --           | 'retraining' (Opptrening) | 'return' (Retur).
  ADD COLUMN IF NOT EXISTS stage TEXT,
  -- Rehab-fremdrift 0..100. NULL = utled av status/datoer på klienten.
  ADD COLUMN IF NOT EXISTS progress_percent SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dancer_injury_log_stage_values'
  ) THEN
    ALTER TABLE dancer_injury_log
      ADD CONSTRAINT dancer_injury_log_stage_values
      CHECK (stage IS NULL OR stage IN ('acute','treatment','retraining','return'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dancer_injury_log_progress_range'
  ) THEN
    ALTER TABLE dancer_injury_log
      ADD CONSTRAINT dancer_injury_log_progress_range
      CHECK (progress_percent IS NULL OR (progress_percent BETWEEN 0 AND 100));
  END IF;
END $$;
