-- =====================================================================
-- 0347_prototype_feedback_messages_read_at.sql
--
-- UX: «nytt svar»-varsling. Legg til read_at på prototype_feedback_messages så
-- vi kan vise testeren når Creatorhub har svart i en tråd de ikke har åpnet.
-- Markeres lest når mottakeren åpner tråden (GET .../messages).
-- Backend legger også til kolonnen lazily (ensureMessagesTable).
-- =====================================================================

BEGIN;

ALTER TABLE prototype_feedback_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pf_messages_unread
  ON prototype_feedback_messages (feedback_id, sender_role)
  WHERE read_at IS NULL;

COMMIT;
