-- 0336_editing_source_files.sql
-- Kildefiler fra fotograf -> ekstern redigerer.
--
-- Fram til nå har editing_job_files kun handlet om VENDORENS leveranse
-- (staging -> fotografens BYO-B2, jf. 0323). Men for at fotografen skal kunne
-- «sende filene enkelt til redigereren» trenger vi den motsatte retningen:
-- fotografen laster RÅ-/kildefiler opp til samme staging-bøtte, og redigereren
-- henter dem ned (presignert GET) når avtalen er inngått.
--
-- Vi skiller retningene med file_role slik at server-side leverings-overføringen
-- (transferStagingToPhotographer, som plukker transfer_status IN ('staged',
-- 'failed')) ALDRI rører kildefilene. Kildefiler får transfer_status='source'.

ALTER TABLE editing_job_files
  ADD COLUMN IF NOT EXISTS file_role varchar NOT NULL DEFAULT 'delivery';

-- Eksisterende rader er alle vendor-leveranser.
UPDATE editing_job_files SET file_role = 'delivery' WHERE file_role IS NULL;

CREATE INDEX IF NOT EXISTS idx_editing_job_files_role
  ON editing_job_files (job_id, file_role);
