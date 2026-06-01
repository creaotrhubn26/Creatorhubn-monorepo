-- Partnership talent-foreslåelse: byrå → produksjon per prosjekt-rolle.
--
-- Forutsetter at byrået har akseptert en prosjekt-invitasjon
-- (partnership_project_invitations.status = 'accepted'). Byrået foreslår
-- talenter fra eget register (talent_consent_registry) til spesifikke
-- casting_roles i prosjektet. Produksjon svarer per forslag.
--
-- IKKE samme som agency_talent_proposals (Phase 7.5 reverse-consent
-- byrå → talent). Den er for å invitere en NY talent til registret.
-- Dette er byrå → produksjon for å foreslå EN EKSISTERENDE talent
-- til en spesifikk casting-rolle.

CREATE TABLE IF NOT EXISTS partnership_talent_proposals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id     UUID NOT NULL REFERENCES partnership_project_invitations(id) ON DELETE CASCADE,
  talent_id         UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  casting_role_id   VARCHAR(255) REFERENCES casting_roles(id) ON DELETE SET NULL,
  proposed_by_user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  agency_notes      TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','accepted','declined','withdrawn')),
  production_notes  TEXT,
  responded_at      TIMESTAMPTZ,
  response_user_id  VARCHAR(255) REFERENCES users(id),
  withdrawn_at      TIMESTAMPTZ,
  is_demo           BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Én aktiv proposal per (invitation, talent, rolle). Etter withdrawn
  -- eller declined kan en ny lages.
  CONSTRAINT partnership_talent_proposals_unique_active
    UNIQUE (invitation_id, talent_id, casting_role_id)
);

CREATE INDEX IF NOT EXISTS ptp_invitation_idx
  ON partnership_talent_proposals (invitation_id, status);
CREATE INDEX IF NOT EXISTS ptp_talent_idx
  ON partnership_talent_proposals (talent_id, status);
CREATE INDEX IF NOT EXISTS ptp_role_idx
  ON partnership_talent_proposals (casting_role_id, status);


-- updated_at-trigger
DROP TRIGGER IF EXISTS ptp_set_updated_at ON partnership_talent_proposals;
CREATE TRIGGER ptp_set_updated_at
  BEFORE UPDATE ON partnership_talent_proposals
  FOR EACH ROW EXECUTE FUNCTION agency_production_partnerships_set_updated_at();
