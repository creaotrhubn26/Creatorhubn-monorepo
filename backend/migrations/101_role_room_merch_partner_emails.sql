-- Role Room — log of cooperation/outreach emails sent to merch partners.
--
-- Records every email a producer sends through the system so we have
-- per-project + per-partner correspondence history. Body is stored as
-- markdown (the same draft Claude produced) so the producer can review
-- exactly what went out — no re-formatting surprises.
--
-- gmail_message_id is the SMTP envelope-id from nodemailer's response;
-- producers can search their own Sent-folder by it.

CREATE TABLE IF NOT EXISTS role_room_merch_partner_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(64) NOT NULL,
  partner_orgnr VARCHAR(16),
  partner_name VARCHAR(200) NOT NULL,
  partner_email VARCHAR(320) NOT NULL,
  cc_email VARCHAR(320),
  subject TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'sent',
  gmail_message_id TEXT,
  error_message TEXT,
  sent_by_user_id VARCHAR(64),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_merch_partner_emails_project_idx
  ON role_room_merch_partner_emails (project_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS role_room_merch_partner_emails_partner_idx
  ON role_room_merch_partner_emails (project_id, partner_orgnr, sent_at DESC);
