-- 0072_dance_invite_pin.sql
-- Magic-link + PIN-bekreftelse på dans-team-invite for GDPR/sikkerhet.
--
-- Flyt:
--   1. Studio-eier oppretter invite → email sendes med magic link
--      (https://creatorhubn.com/dance/invite/<token>)
--   2. Mottaker klikker → landing-side leser invite-info (public, ingen auth)
--   3. Landing-side trigger sender 6-sifret PIN til invited_email
--   4. Mottaker leser PIN i e-post, paste inn på landing-side
--   5. PIN bekreftet → user-konto opprettes hvis ikke finnes, session-token
--      utstedes, invite markeres accepted_at + invitee bindes til team
--
-- Sikkerhet:
--   • PIN er 6 sifre, hashet (SHA-256 + token-prefix-salt) før lagring
--   • PIN utløper 15 minutter etter pin_sent_at
--   • Maks 3 forsøk (pin_attempts), så låses invite til Studio-eier
--     genererer nytt token
--   • PIN-request rate-limited app-side (60s mellom forsøk per token)
--   • IP + user-agent logges på aksept for audit-trail (GDPR Article 30)

ALTER TABLE dance_team_invite
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pin_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepting_ip TEXT,
  ADD COLUMN IF NOT EXISTS accepting_user_agent TEXT;

COMMENT ON COLUMN dance_team_invite.pin_hash IS 'SHA-256(token-prefix || pin). NULL inntil første pin-request.';
COMMENT ON COLUMN dance_team_invite.pin_sent_at IS 'Når PIN ble sendt. PIN er gyldig i 15 min etter dette.';
COMMENT ON COLUMN dance_team_invite.pin_attempts IS 'Antall mislykkede pin-forsøk. Låses ved 3.';
COMMENT ON COLUMN dance_team_invite.pin_locked_at IS 'Satt når pin_attempts >= 3. Studio-eier må generere nytt token for å gjenåpne.';
COMMENT ON COLUMN dance_team_invite.accepting_ip IS 'IP-adresse ved aksept. Lagres for audit (GDPR Art. 30) — slettes med invite-rad ved retention-policy.';
COMMENT ON COLUMN dance_team_invite.accepting_user_agent IS 'User-agent ved aksept. Audit-trail.';

-- Sjekkbeskytter — pin_hash MÅ ha en pin_sent_at, og motsatt
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dance_team_invite_pin_consistency'
  ) THEN
    ALTER TABLE dance_team_invite
      ADD CONSTRAINT dance_team_invite_pin_consistency
        CHECK (
          (pin_hash IS NULL AND pin_sent_at IS NULL)
          OR (pin_hash IS NOT NULL AND pin_sent_at IS NOT NULL)
        );
  END IF;
END$$;
