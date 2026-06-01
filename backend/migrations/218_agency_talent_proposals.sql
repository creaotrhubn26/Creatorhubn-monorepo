-- Agency Talent Proposals — Phase 7.5 reverse-consent-flow.
--
-- Stella, NSF eller produsenter kan FORESLÅ en skuespiller til sitt
-- talent-register. Skuespilleren får e-post med godkjennings-lenke.
-- INGEN data deles før skuespilleren eksplisitt aksepterer.
--
-- Dette er GDPR-grunnlaget for reverse-consent: agency kan ikke legge
-- talent til sitt register uten talentens eksplisitte samtykke.

CREATE TABLE IF NOT EXISTS agency_talent_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_org_id UUID NOT NULL REFERENCES agency_orgs(id) ON DELETE CASCADE,
  proposed_by_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  -- Hvem skal foreslås (talent vet vi ikke ennå om eksisterer):
  proposed_email VARCHAR(255) NOT NULL,
  proposed_display_name VARCHAR(255),
  proposed_phone VARCHAR(50),

  -- Hvilke scopes agency ber om
  -- Default: basic_profile + audition_invitations (minst invasivt)
  requested_scopes JSONB NOT NULL DEFAULT '["basic_profile","audition_invitations"]',

  -- Hva agency vil at talent skal vite om hvorfor de foreslås
  personal_message TEXT,
  -- Hva slags rolle agency tenker på (valgfri, fri-tekst)
  context_role TEXT,

  -- Lifecycle
  token VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | accepted | declined | expired | cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Hvis akseptert: peker til den (nyopprettede eller eksisterende) talenten
  resolved_talent_id UUID REFERENCES talents(id) ON DELETE SET NULL,
  -- Hvem aksepterte (kan være en eksisterende user, eller en ny som nettopp
  -- registrerte seg via accept-flowen)
  resolved_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS agency_talent_proposals_agency_idx ON agency_talent_proposals (agency_org_id);
CREATE INDEX IF NOT EXISTS agency_talent_proposals_token_idx ON agency_talent_proposals (token);
CREATE INDEX IF NOT EXISTS agency_talent_proposals_email_idx ON agency_talent_proposals (LOWER(proposed_email));
CREATE INDEX IF NOT EXISTS agency_talent_proposals_status_idx ON agency_talent_proposals (status);

-- Unik per (agency, email) for å unngå spam-foreslag av samme person
CREATE UNIQUE INDEX IF NOT EXISTS agency_talent_proposals_unique_pending
  ON agency_talent_proposals (agency_org_id, LOWER(proposed_email))
  WHERE status = 'pending';
