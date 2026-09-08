-- Persist delivery and engagement evidence for direct prototype-tester
-- invitations. Application-based invitations keep their existing
-- invite_requests tracking; the admin API coalesces both sources.

ALTER TABLE prototype_tester_invites
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_provider VARCHAR(80),
  ADD COLUMN IF NOT EXISTS email_message_id TEXT,
  ADD COLUMN IF NOT EXISTS email_delivery_reason TEXT,
  ADD COLUMN IF NOT EXISTS email_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_link_clicked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_prototype_tester_invites_delivery_status
  ON prototype_tester_invites (status, email_sent_at DESC, created_at DESC);

COMMENT ON COLUMN prototype_tester_invites.email_sent_at IS
  'Provider-confirmed send time for a prototype-tester invitation.';

COMMENT ON COLUMN prototype_tester_invites.email_opened_at IS
  'First observed tracking-pixel open for this invitation.';

COMMENT ON COLUMN prototype_tester_invites.invite_link_clicked_at IS
  'First observed click of this invitation acceptance link.';
