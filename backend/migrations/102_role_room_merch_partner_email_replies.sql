-- Role Room — partner replies to merch-cooperation emails (Slice 7c).
--
-- Producer-marked entries: when a partner replies to a sent cooperation
-- email (which they see in their own Gmail since we BCC them), they
-- click "Marker svar" in the agent and paste in a 1-3 sentence summary
-- + a sentiment pill so we can show "Lindeberg SK ✓ Positivt svar 5.
-- mai" on the supplier card.
--
-- Future: auto-poll via IMAP and skip the manual step. Schema is
-- designed to support both — `auto_detected_message_id` is null for
-- producer-entered rows, populated for IMAP-discovered ones.

CREATE TABLE IF NOT EXISTS role_room_merch_partner_email_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_email_id UUID NOT NULL REFERENCES role_room_merch_partner_emails(id) ON DELETE CASCADE,
  project_id VARCHAR(64) NOT NULL,
  /** Free-text 1-3 sentence summary the producer pasted in. */
  reply_summary TEXT NOT NULL,
  /** Optional: full reply body when producer copy-pastes the whole thing. */
  reply_full_text TEXT,
  /** Producer-set sentiment for at-a-glance status on the supplier card. */
  sentiment VARCHAR(16) NOT NULL DEFAULT 'neutral',
  /** When IMAP-polling lands later, this carries the Gmail Message-Id of
   *  the auto-detected reply so we don't double-log producer-entered + auto. */
  auto_detected_message_id TEXT,
  replied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  marked_by_user_id VARCHAR(64),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_merch_partner_email_replies_project_idx
  ON role_room_merch_partner_email_replies (project_id, replied_at DESC);

CREATE INDEX IF NOT EXISTS role_room_merch_partner_email_replies_sent_idx
  ON role_room_merch_partner_email_replies (sent_email_id);
