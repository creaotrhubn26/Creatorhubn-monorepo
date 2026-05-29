-- Logger hver transactional e-post-send fra The Role Room/CreatorHub.
-- Brukes til Admin Room-dashboard for Resend-status + brukstall mot
-- 3000/mnd gratis-grensen.
--
-- provider: 'resend' | 'smtp'
-- status:   'sent' | 'failed'
-- kind:     'client_invite' | 'talent_invite' | 'password_reset' | ...
CREATE TABLE IF NOT EXISTS transactional_email_log (
  id            BIGSERIAL PRIMARY KEY,
  provider      TEXT NOT NULL,
  status        TEXT NOT NULL,
  message_id    TEXT,
  to_email      TEXT NOT NULL,
  subject       TEXT,
  kind          TEXT,
  project_id    TEXT,
  sent_by_user_id TEXT,
  error_reason  TEXT,
  error_message TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_email_log_sent_at ON transactional_email_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_email_log_status_sent_at ON transactional_email_log(status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_email_log_provider_sent_at ON transactional_email_log(provider, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_email_log_kind_sent_at ON transactional_email_log(kind, sent_at DESC);
