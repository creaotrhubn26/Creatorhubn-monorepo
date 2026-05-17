-- 0110_photo_venue_contributions.sql
-- Community-bidrag til foto-lokasjons-katalogen (Slice 9X.35).
--
-- Stine kan:
--   1. Forslå NY venue (proposal_kind='new', target_venue_id IS NULL)
--   2. Forslå korrigering på eksisterende (proposal_kind='diff',
--      target_venue_id = eksisterende venue, proposed_data = kun feltene
--      hun endrer)
--
-- Admin godkjenner/avslår. Ved approval merges proposed_data inn i
-- photo_venues. Reviewer + tidspunkt logges for revisjons-formål.

CREATE TABLE IF NOT EXISTS photo_venue_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_user_id TEXT NOT NULL,
  contributor_email TEXT,
  contributor_name TEXT,
  proposal_kind TEXT NOT NULL CHECK (proposal_kind IN ('new', 'diff')),
  target_venue_id UUID,
  -- NULL for 'new', referanse til photo_venues.id for 'diff'
  proposed_data JSONB NOT NULL,
  -- Hele venue-objektet for 'new', kun endrede felter for 'diff'
  contributor_note TEXT,
  -- Stines kommentar til bidraget (f.eks. "Var nylig der, pris endret seg")

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venue_contributions_status
  ON photo_venue_contributions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_venue_contributions_contributor
  ON photo_venue_contributions (contributor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_venue_contributions_target
  ON photo_venue_contributions (target_venue_id) WHERE target_venue_id IS NOT NULL;

COMMENT ON COLUMN photo_venue_contributions.proposed_data IS
  'JSONB med foreslåtte feltverdier. For "new": fullstendig venue. For "diff": kun endringer.';
COMMENT ON COLUMN photo_venue_contributions.target_venue_id IS
  'NULL for nye venues, ellers FK til photo_venues.id (uten enforcement for å overleve venue-sletting).';
