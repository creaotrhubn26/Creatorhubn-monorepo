-- 269_audio_member_profiles.sql
--
-- Bidragsyter-profiler + invitasjonslenke for Audio Showcase-samarbeid.
-- En produsent inviterer et medlem → invite_token genereres → medlemmet åpner
-- lenken og fyller ut profilen sin (eller produsenten fyller ut). Lettvekts:
-- ingen konto kreves — profilen er knyttet til review-medlemskapet.

ALTER TABLE audio_review_members ADD COLUMN IF NOT EXISTS email          TEXT;
ALTER TABLE audio_review_members ADD COLUMN IF NOT EXISTS phone          TEXT;
ALTER TABLE audio_review_members ADD COLUMN IF NOT EXISTS instrument     TEXT;
ALTER TABLE audio_review_members ADD COLUMN IF NOT EXISTS bio            TEXT;
ALTER TABLE audio_review_members ADD COLUMN IF NOT EXISTS avatar_url     TEXT;
ALTER TABLE audio_review_members ADD COLUMN IF NOT EXISTS links          JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE audio_review_members ADD COLUMN IF NOT EXISTS invite_token   TEXT;
-- pending (invitert, ikke fylt ut) | active (profil utfylt) | owner
ALTER TABLE audio_review_members ADD COLUMN IF NOT EXISTS invite_status  TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE audio_review_members ADD COLUMN IF NOT EXISTS invited_at     TIMESTAMPTZ;
ALTER TABLE audio_review_members ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_audio_members_invite_token ON audio_review_members (invite_token) WHERE invite_token IS NOT NULL;

-- Eksisterende eier-medlemmer regnes som ferdige profiler.
UPDATE audio_review_members SET invite_status = 'owner' WHERE is_owner = TRUE AND invite_status = 'pending';
