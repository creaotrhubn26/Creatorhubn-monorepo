-- 0124_assistant_creatorhubn_referral.sql
-- Slice 9X.51 — Stine kan invitere assistenten til å bli Creatorhubn-bruker
-- selv (referral). Fase A: bare tracker at invitasjonen ble sendt og at
-- assistenten klikket. Fase B (senere) tracker signup + provisjon.
--
-- Hvorfor separat fra invite_token: invite_token nullstilles ved sign.
-- Referral-CTA-en vises på accept-success-skjermen og må fortsatt være
-- intakt for analytics-purposes etter signering.

ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS referral_invite_sent_at TIMESTAMPTZ;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS referral_clicked_at TIMESTAMPTZ;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS referral_signed_up_user_id TEXT;
ALTER TABLE wedding_assistants
  ADD COLUMN IF NOT EXISTS referral_signed_up_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_wedding_assistants_referral_sent
  ON wedding_assistants (referral_invite_sent_at)
  WHERE referral_invite_sent_at IS NOT NULL;

COMMENT ON COLUMN wedding_assistants.referral_invite_sent_at IS
  'Tidspunkt Stine huket av "Inviter også til Creatorhubn"-boksen. Driver visning av signup-CTA på accept-success-skjermen.';
COMMENT ON COLUMN wedding_assistants.referral_signed_up_user_id IS
  'Settes når assistenten faktisk registrerer seg som Creatorhubn-bruker. Fase B bruker dette til provisjons-beregning.';
