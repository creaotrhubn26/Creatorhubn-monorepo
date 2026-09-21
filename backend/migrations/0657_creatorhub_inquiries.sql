-- Canonical CreatorHub inquiry inbox shared by WorkspaceShell and CaptureApp.
-- Existing client_submissions rows are preserved; ownership is backfilled from
-- the historical vendor/user columns and from the account e-mail where possible.

BEGIN;

ALTER TABLE client_submissions
  ADD COLUMN IF NOT EXISTS owner_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS vendor_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS vendor_email VARCHAR(320),
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS submission_type VARCHAR(64) DEFAULT 'inquiry',
  ADD COLUMN IF NOT EXISTS category VARCHAR(64) DEFAULT 'inquiry',
  ADD COLUMN IF NOT EXISTS source_channel VARCHAR(64) DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE client_submissions
   SET owner_user_id = COALESCE(
     NULLIF(owner_user_id, ''),
     NULLIF(vendor_id, ''),
     NULLIF(assigned_photographer, ''),
     (
       SELECT u.id::text
         FROM users u
        WHERE LOWER(u.email) = LOWER(client_submissions.vendor_email)
        LIMIT 1
     )
   )
 WHERE owner_user_id IS NULL OR owner_user_id = '';

UPDATE client_submissions
   SET vendor_id = owner_user_id
 WHERE (vendor_id IS NULL OR vendor_id = '')
   AND owner_user_id IS NOT NULL;

UPDATE client_submissions s
   SET vendor_email = u.email
  FROM users u
 WHERE (s.vendor_email IS NULL OR s.vendor_email = '')
   AND u.id::text = s.owner_user_id;

CREATE INDEX IF NOT EXISTS client_submissions_owner_status_idx
  ON client_submissions(owner_user_id, status, submitted_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS client_submissions_vendor_email_idx
  ON client_submissions(LOWER(vendor_email), submitted_at DESC);
CREATE INDEX IF NOT EXISTS client_submissions_project_idx
  ON client_submissions(project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS client_submissions_unread_idx
  ON client_submissions(owner_user_id, submitted_at DESC)
  WHERE is_read = FALSE;

DO $$ BEGIN
  ALTER TABLE client_submissions
    ADD CONSTRAINT client_submissions_owner_user_fk
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE client_submissions
    ADD CONSTRAINT client_submissions_status_check
    CHECK (status IS NULL OR status IN (
      'new', 'contacted', 'replied', 'quote_sent', 'booked', 'converted',
      'completed', 'declined', 'archived', 'spam', 'lost'
    )) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE client_submissions
    ADD CONSTRAINT client_submissions_priority_check
    CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high', 'urgent')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE client_submissions
    ADD CONSTRAINT client_submissions_type_check
    CHECK (submission_type IS NULL OR submission_type = 'inquiry') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS client_submission_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id VARCHAR NOT NULL
    REFERENCES client_submissions(id) ON DELETE CASCADE,
  owner_user_id VARCHAR(255) NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  recipient_email VARCHAR(320) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  delivery_status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  provider_message_id VARCHAR(255),
  error_code VARCHAR(120),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_submission_replies_submission_idx
  ON client_submission_replies(submission_id, created_at ASC);
CREATE INDEX IF NOT EXISTS client_submission_replies_owner_idx
  ON client_submission_replies(owner_user_id, created_at DESC);

COMMIT;
