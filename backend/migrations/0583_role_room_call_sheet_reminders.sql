-- Preserve every acknowledgement capability while allowing production to
-- remind only recipients who have not confirmed receipt.
ALTER TABLE role_room_call_sheet_recipients
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0 CHECK (reminder_count >= 0),
  ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS role_room_call_sheet_recipient_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES role_room_call_sheet_recipients(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rr_call_sheet_recipient_tokens_recipient
  ON role_room_call_sheet_recipient_tokens(recipient_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_call_sheet_recipient_tokens_hash
  ON role_room_call_sheet_recipient_tokens(token_hash);

-- 0578 created this as a plain helper index alongside an unnamed UNIQUE
-- constraint. Keep one named unique index so the physical schema matches the
-- Drizzle declaration exactly.
DROP INDEX IF EXISTS idx_rr_call_sheet_recipients_token;
CREATE UNIQUE INDEX idx_rr_call_sheet_recipients_token
  ON role_room_call_sheet_recipients(token_hash);
ALTER TABLE role_room_call_sheet_recipients
  DROP CONSTRAINT IF EXISTS role_room_call_sheet_recipients_token_hash_key;
