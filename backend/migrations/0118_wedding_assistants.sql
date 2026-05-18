-- 0118_wedding_assistants.sql
-- Assistent-fotografer på bryllup (Slice 9X.44). Stine kan invitere:
--   1. En annen Creatorhubn-bruker (assistant_user_id satt)
--   2. En ekstern person (assistant_email + invite_token for accept-flyt)
--
-- Kompensasjon:
--   - 'hourly': compensation_value = kr/t × dokumentert tid på timeline
--   - 'fixed': compensation_value = flat sum
--   - 'percentage': share_pct = % av total netto (etter Stines egne utlegg)
--
-- Rollebegrepet 'second_shooter' er etablert norsk bryllupsfoto-praksis
-- (to fotografer som dekker brud + brudgom parallelt om morgenen).

CREATE TABLE IF NOT EXISTS wedding_assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id VARCHAR(64) NOT NULL,
  primary_photographer_id TEXT NOT NULL,
  -- Stine — eieren av bryllupsoppdraget
  assistant_user_id TEXT,
  -- Hvis intern Creatorhubn-bruker. NULL = ekstern.
  assistant_email TEXT,
  assistant_name TEXT,
  assistant_phone TEXT,
  role TEXT NOT NULL DEFAULT 'assistant'
    CHECK (role IN ('primary', 'assistant', 'second_shooter', 'video', 'misc')),
  -- 'primary' er kun for Stine selv ved migrering av eksisterende oppdrag
  compensation_type TEXT NOT NULL DEFAULT 'fixed'
    CHECK (compensation_type IN ('hourly', 'fixed', 'percentage')),
  compensation_value NUMERIC(10,2),
  -- kr/t (hourly), flat sum (fixed), eller % (percentage — tolkes som share_pct)
  share_pct NUMERIC(5,2),
  -- 0.00-100.00. Settes for 'percentage', kan brukes uavhengig for splitting
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'accepted', 'declined', 'cancelled', 'completed')),
  invite_token TEXT,
  -- Genereres ved invite. NULL etter accept.
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wedding_assistants_wedding
  ON wedding_assistants (wedding_id);
CREATE INDEX IF NOT EXISTS idx_wedding_assistants_user
  ON wedding_assistants (assistant_user_id)
  WHERE assistant_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_wedding_assistants_token
  ON wedding_assistants (invite_token)
  WHERE invite_token IS NOT NULL;

COMMENT ON COLUMN wedding_assistants.share_pct IS
  '% av total honorar (eks. utlegg) som tildeles denne assistenten. Sjekk: SUM(share_pct) per wedding bør være ≤ 100.';
COMMENT ON COLUMN wedding_assistants.invite_token IS
  'URL-safe random token. Used for /wedding/assistant-invite/:token accept-flow. NULL etter accept.';
