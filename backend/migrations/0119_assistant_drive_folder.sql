-- 0119_assistant_drive_folder.sql
-- Slice 9X.45 — Assistent leverer innhold via delt Google Drive-mappe.
--
-- Flyt:
--   1. Stine inviterer assistent (9X.44) → status 'invited' eller 'accepted'
--   2. Stine trykker "Sett opp delt Drive-mappe" → Creatorhubn:
--      - Sjekker at Stines Google Drive er koblet
--      - Lager subfolder under "Creatorhubn"-rot (eller selv-rot)
--      - Deler med assistant_email som contentManager (med sendNotificationEmail)
--      - Lagrer drive_folder_id + url her
--      - Setter baseline_file_count = 0
--   3. Background-poller sjekker hver 5-10 min: hvis file count > forrige →
--      sender push + e-post til Stine, oppdaterer counter
--   4. Stine åpner AssistantsPanel → ser badge med antall nye filer →
--      ett klikk åpner Drive-mappa

ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS drive_folder_url TEXT;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS drive_folder_setup_at TIMESTAMPTZ;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS baseline_file_count INTEGER DEFAULT 0;
-- file_count på tidspunktet folder ble satt opp; nye filer = current - baseline
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS last_known_file_count INTEGER DEFAULT 0;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS last_new_files_at TIMESTAMPTZ;
-- siste gang en ny fil ble detektert (for "siste opplastning for X min siden")
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS new_files_since_viewed INTEGER DEFAULT 0;
-- antall nye filer som ikke er bekreftet sett av Stine

CREATE INDEX IF NOT EXISTS idx_wedding_assistants_polling
  ON wedding_assistants (last_polled_at)
  WHERE drive_folder_id IS NOT NULL AND status = 'accepted';

COMMENT ON COLUMN wedding_assistants.baseline_file_count IS
  'File count ved opprettelse av mappen. Hvis Stine putter eksisterende bilder der manuelt, settes denne sammen så vi ikke teller dem som "nye fra assistent".';
COMMENT ON COLUMN wedding_assistants.new_files_since_viewed IS
  'Nullstilles når Stine åpner Drive-mappa via Creatorhubn-UI. Brukes til badge-count.';
