-- 0329_capture_beta_signups.sql
-- Påmelding til iPad Capture-app beta (TestFlight). Offentlig signup fra
-- prosjektmodalens backup-strategi-kort.
BEGIN;

CREATE TABLE IF NOT EXISTS capture_beta_signups (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"       varchar,
  "email"      varchar NOT NULL,
  "device"     varchar,
  "note"       text,
  "user_id"    varchar,
  "status"     varchar DEFAULT 'pending', -- pending|invited|joined
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capture_beta_email ON capture_beta_signups (email);

COMMIT;
