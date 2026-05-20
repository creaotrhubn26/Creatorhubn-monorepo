-- 0140 — NextRole referrals
--
-- Hver bruker har én delelig referral-kode. Når en annen bruker
-- registrerer seg og fullfører Stripe-checkout med koden i settings,
-- får begge 1 ekstra måned gratis (logges som "bonus" på installasjonen
-- og kan håndteres via Stripe-kupong eller forlenget trial_ends_at).
--
-- Tabeller:
--   nextrole_referral_codes — én rad per bruker, deres unike kode
--   nextrole_referrals      — én rad per innløsning (UNIQUE på
--                              redeemed_by_user_id slik at hver bruker
--                              bare kan løse inn én kode i livet)

CREATE TABLE IF NOT EXISTS nextrole_referral_codes (
  user_id     VARCHAR(255) PRIMARY KEY,
  code        VARCHAR(16)  NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nextrole_referral_codes_code_idx
  ON nextrole_referral_codes (code);

CREATE TABLE IF NOT EXISTS nextrole_referrals (
  id                          BIGSERIAL    PRIMARY KEY,
  code                        VARCHAR(16)  NOT NULL,
  referrer_user_id            VARCHAR(255) NOT NULL,
  redeemed_by_user_id         VARCHAR(255) NOT NULL UNIQUE,

  -- Når Stripe-checkout fullført — da utløses bonus til begge parter.
  reward_eligible_at          TIMESTAMPTZ,
  reward_applied_referrer_at  TIMESTAMPTZ,
  reward_applied_redeemer_at  TIMESTAMPTZ,

  redeemed_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nextrole_referrals_referrer_idx
  ON nextrole_referrals (referrer_user_id);
CREATE INDEX IF NOT EXISTS nextrole_referrals_code_idx
  ON nextrole_referrals (code);
CREATE INDEX IF NOT EXISTS nextrole_referrals_pending_rewards_idx
  ON nextrole_referrals (reward_applied_referrer_at, reward_applied_redeemer_at)
  WHERE reward_eligible_at IS NOT NULL;
