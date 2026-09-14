-- 0604_chat_threads_indexes.sql
--
-- Tråder i prosjektchatten. Kolonnen finnes allerede:
-- `communication_messages.parent_message_id` ble laget i 0001, med selv-
-- fremmednøkkel, og har stått ubrukt siden — ingenting har noensinne skrevet
-- til den. Denne migrasjonen legger derfor ingen kolonne; den legger indeksene
-- de to nye spørringene trenger, og som ikke finnes fra før:
--
--   1. «hvor mange svar har disse meldingene» — én gruppert opptelling per
--      side med rotmeldinger.
--   2. «vis tråden til denne meldingen» — alle svar på én forelder.
--
-- Begge nøkler på (parent_message_id, channel_id). Delvis indeks: svar er en
-- liten hale av tabellen, og rotmeldinger (NULL) trenger ingen plass her.
--
-- Hovedlista henter nå kun rotmeldinger, altså `parent_message_id IS NULL` i
-- tillegg til kanal + tid. Den får sin egen delvise indeks av samme grunn.
--
-- Idempotent: bare CREATE INDEX IF NOT EXISTS, ingen datamigrering, kan kjøres
-- på nytt uten effekt.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('0604_chat_threads_indexes'));

CREATE INDEX IF NOT EXISTS idx_communication_messages_thread
  ON communication_messages (parent_message_id, channel_id)
  WHERE parent_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_communication_messages_channel_roots
  ON communication_messages (channel_id, created_at DESC)
  WHERE parent_message_id IS NULL;

COMMIT;
