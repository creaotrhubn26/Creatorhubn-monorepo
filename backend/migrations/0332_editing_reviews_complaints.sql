-- 0332_editing_reviews_complaints.sql
-- Kvalitet/tillit for editing-marketplace: fotograf-anmeldelser + leverings-klager.
-- Mange klager → vendor flagges → partnerskap kan avsluttes (skjules fra discovery).
-- Apply m/ ON_ERROR_STOP=1, IKKE --single-transaction.
BEGIN;

-- Anmeldelser (fotograf vurderer vendor etter levering/godkjenning).
CREATE TABLE IF NOT EXISTS editing_vendor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id varchar(255),
  vendor_user_id varchar(255) NOT NULL,
  photographer_id varchar(255) NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  aspects jsonb DEFAULT '{}'::jsonb,   -- {quality, communication, deadline, ...} 1-5
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evr_vendor ON editing_vendor_reviews (vendor_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_evr_job_photog ON editing_vendor_reviews (job_id, photographer_id)
  WHERE job_id IS NOT NULL;  -- én anmeldelse per oppdrag per fotograf

-- Leverings-klager.
CREATE TABLE IF NOT EXISTS editing_vendor_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id varchar(255),
  vendor_user_id varchar(255) NOT NULL,
  photographer_id varchar(255) NOT NULL,
  category varchar(40) NOT NULL,       -- quality|deadline|scope|communication|other
  detail text,
  status varchar(20) NOT NULL DEFAULT 'open',  -- open|reviewing|resolved|dismissed
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_evc_vendor ON editing_vendor_complaints (vendor_user_id, status);

-- Aggregat + kvalitets-flagg på vendor-profilen (discovery/tier leser rating/review_count).
ALTER TABLE vendor_onboarding_profiles
  ADD COLUMN IF NOT EXISTS quality_flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS open_complaint_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaint_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_flagged_at timestamptz;

COMMIT;
