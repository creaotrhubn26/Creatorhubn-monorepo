-- 271_audio_invite_expiry.sql
--
-- Utløp på invitasjons-/member-tokens (hardening). 90 dager fra invitasjon.
-- Offentlige invite/shared-endepunkter avviser utløpte tokens (410 Gone).

ALTER TABLE audio_review_members ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
UPDATE audio_review_members
   SET invite_expires_at = COALESCE(invited_at, created_at, NOW()) + INTERVAL '90 days'
 WHERE invite_token IS NOT NULL AND invite_expires_at IS NULL;
