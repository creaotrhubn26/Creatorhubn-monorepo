-- 0325_editing_job_split_sheet_link.sql
-- Kobler redigerings-oppdrag inn i kalkuleringen (split-sheet). Velges PR OPPDRAG:
--   cost_model='fixed_fee'     -> fast honorar, vises som KOSTNAD av-toppen før inntektsdeling
--   cost_model='revenue_share' -> vendor får PROSENT av inntekt -> egen split_sheet_contributor (rolle 'collaborator')
--
-- Konvensjoner (migrate.sh): egen BEGIN/COMMIT, idempotent.

BEGIN;

ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS cost_model varchar DEFAULT 'fixed_fee'; -- fixed_fee | revenue_share
ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS revenue_share_pct numeric(5, 2);        -- brukt når revenue_share
ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS split_sheet_id uuid;                     -- knyttet split-sheet (kalkyle)
ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS split_sheet_contributor_id uuid;         -- opprettet contributor-rad ved revenue_share

CREATE INDEX IF NOT EXISTS idx_editing_jobs_split_sheet ON editing_jobs (split_sheet_id);

COMMIT;
