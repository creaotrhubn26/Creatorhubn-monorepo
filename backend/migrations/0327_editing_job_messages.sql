-- 0327_editing_job_messages.sql
-- Kommunikasjon fotograf <-> vendor pr redigerings-oppdrag. Tilgjengelig først
-- når avtale er inngått (vendor har akseptert -> status forbi 'requested').
--
-- Konvensjoner (migrate.sh): egen BEGIN/COMMIT, idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS editing_job_messages (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id"      uuid NOT NULL,
  "sender_id"   varchar NOT NULL,
  "sender_role" varchar NOT NULL, -- photographer | vendor
  "body"        text NOT NULL,
  "read_at"     timestamp,
  "created_at"  timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editing_job_messages_job ON editing_job_messages (job_id, created_at);

COMMIT;
