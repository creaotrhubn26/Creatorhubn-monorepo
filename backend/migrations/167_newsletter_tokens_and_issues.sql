-- Newsletter-stack utvidelse:
-- (1) confirm/unsubscribe-tokens på signups for double-opt-in + CAN-SPAM
-- (2) issues-tabell for skrevne brief-utgaver (draft → sent)
-- (3) sends-tabell for audit per mottaker

ALTER TABLE role_room_newsletter_signups
  ADD COLUMN IF NOT EXISTS confirm_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(64);

UPDATE role_room_newsletter_signups
   SET confirm_token = encode(gen_random_bytes(24), 'hex')
 WHERE confirm_token IS NULL;

UPDATE role_room_newsletter_signups
   SET unsubscribe_token = encode(gen_random_bytes(24), 'hex')
 WHERE unsubscribe_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_role_room_newsletter_confirm_token
  ON role_room_newsletter_signups (confirm_token)
  WHERE confirm_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_role_room_newsletter_unsubscribe_token
  ON role_room_newsletter_signups (unsubscribe_token)
  WHERE unsubscribe_token IS NOT NULL;

-- Issues (skrevne utgaver av Norwegian Casting Brief)
CREATE TABLE IF NOT EXISTS role_room_newsletter_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  preheader VARCHAR(200),
  body_markdown TEXT NOT NULL DEFAULT '',
  body_html TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_role_room_newsletter_issues_user
  ON role_room_newsletter_issues (user_id, status);

CREATE INDEX IF NOT EXISTS idx_role_room_newsletter_issues_status
  ON role_room_newsletter_issues (status, scheduled_for);

-- Audit per send
CREATE TABLE IF NOT EXISTS role_room_newsletter_issue_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES role_room_newsletter_issues(id) ON DELETE CASCADE,
  signup_id UUID NOT NULL REFERENCES role_room_newsletter_signups(id) ON DELETE CASCADE,
  email VARCHAR(320) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('queued', 'sent', 'failed', 'bounced', 'skipped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_role_room_newsletter_issue_sends
  ON role_room_newsletter_issue_sends (issue_id, signup_id);

CREATE INDEX IF NOT EXISTS idx_role_room_newsletter_issue_sends_status
  ON role_room_newsletter_issue_sends (issue_id, status);
