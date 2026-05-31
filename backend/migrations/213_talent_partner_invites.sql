-- Talent Partner Invites — Phase 2 e2e for "Invite Partner"-flowen.
--
-- En talent inviterer en partner-konto til å få consent. Partneren
-- mottar en lenke med token; ved å klikke aksepterer de invitasjonen
-- som automatisk granter consent på valgt scope.
--
-- Status: 'pending' (sendt, ikke akseptert), 'accepted' (consent
-- ble opprettet), 'declined' (partner avslo), 'expired' (token utløpt),
-- 'cancelled' (talent trakk invitasjonen).

CREATE TABLE IF NOT EXISTS talent_partner_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,

  -- Hvem inviteres
  partner_type VARCHAR(60) NOT NULL,  -- 'stella_casting' | 'skuespillersenter' osv.
  partner_email VARCHAR(255) NOT NULL,
  partner_display_name VARCHAR(255),

  -- Hvilke scopes consent-en skal gi når akseptert
  -- scopes: ['basic_profile','media_portfolio',...]
  scopes JSONB NOT NULL DEFAULT '["basic_profile"]',

  -- Token for accept-link
  token VARCHAR(64) NOT NULL UNIQUE,

  -- Lifecycle
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  message TEXT,                       -- valgfri personlig melding
  created_by VARCHAR(255),            -- talent.owner_user_id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  accepted_by VARCHAR(255),           -- user-id som faktisk akssepterte
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  cancelled_at TIMESTAMPTZ,

  -- Hvis akseptert: peker til den opprettede agency_org (kan være ny)
  resolved_agency_org_id UUID REFERENCES agency_orgs(id) ON DELETE SET NULL,

  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS talent_partner_invites_talent_idx ON talent_partner_invites (talent_id);
CREATE INDEX IF NOT EXISTS talent_partner_invites_token_idx ON talent_partner_invites (token);
CREATE INDEX IF NOT EXISTS talent_partner_invites_status_idx ON talent_partner_invites (status);
CREATE INDEX IF NOT EXISTS talent_partner_invites_email_idx ON talent_partner_invites (LOWER(partner_email));
