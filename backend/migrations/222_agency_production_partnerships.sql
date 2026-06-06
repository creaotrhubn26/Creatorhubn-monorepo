-- Agency ↔ Production team partnership-modell
--
-- Modell: To-veis samarbeid mellom casting-byrå (agency_orgs) og
-- produksjonsteam (users som eier casting_projects). Partnership er
-- tomme i seg selv — den faktiske scope er PER PROSJEKT via
-- partnership_project_invitations. Det gir GDPR-sterk tidsbegrensning
-- og klar audit-trail.
--
-- Flyt:
--  1. Bryå ELLER produksjonsteam initierer (proposed_by). Status: pending.
--  2. Motparten godkjenner. Status: accepted. responded_at + response_user_id.
--  3. Produksjonsteam inviterer bryået til et SPESIFIKT casting_project →
--     partnership_project_invitations med rolle-IDs.
--  4. Bryået ser rollene + foreslår talenter via talent_consent_registry.
--  5. Tilgang utløper når casting_project.end_date passerer (eller
--     partnership revoked).

CREATE TABLE IF NOT EXISTS agency_production_partnerships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_org_id   UUID NOT NULL REFERENCES agency_orgs(id) ON DELETE CASCADE,
  -- produksjonsteam identifiseres ved owner-user. users.id er VARCHAR(255).
  production_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposed_by     VARCHAR(20) NOT NULL CHECK (proposed_by IN ('agency','production')),
  proposed_by_user_id VARCHAR(255) REFERENCES users(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','declined','revoked')),
  message         TEXT,
  proposed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at    TIMESTAMPTZ,
  response_user_id VARCHAR(255) REFERENCES users(id),
  revoked_at      TIMESTAMPTZ,
  revoked_by_user_id VARCHAR(255) REFERENCES users(id),
  is_demo         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Én pending eller accepted partnership per agency+production-par.
  -- Etter revoked kan en ny lages.
  CONSTRAINT agency_production_partnerships_unique
    UNIQUE (agency_org_id, production_user_id)
);

CREATE INDEX IF NOT EXISTS agency_production_partnerships_agency_idx
  ON agency_production_partnerships (agency_org_id, status);
CREATE INDEX IF NOT EXISTS agency_production_partnerships_prod_idx
  ON agency_production_partnerships (production_user_id, status);
CREATE INDEX IF NOT EXISTS agency_production_partnerships_demo_idx
  ON agency_production_partnerships (is_demo) WHERE is_demo = TRUE;


-- Per-prosjekt invitasjoner — der den faktiske scope ligger
CREATE TABLE IF NOT EXISTS partnership_project_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id  UUID NOT NULL REFERENCES agency_production_partnerships(id) ON DELETE CASCADE,
  casting_project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  invited_by_user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','declined','completed','revoked','expired')),
  -- JSON array med casting_roles.id verdier — null = alle roller i prosjektet
  role_ids        JSONB,
  notes           TEXT,
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at    TIMESTAMPTZ,
  -- Default-utløp: casting_project.end_date + 14 dager, eller 90d
  expires_at      TIMESTAMPTZ,
  is_demo         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT partnership_project_invitations_unique
    UNIQUE (partnership_id, casting_project_id)
);

CREATE INDEX IF NOT EXISTS partnership_project_invitations_partnership_idx
  ON partnership_project_invitations (partnership_id, status);
CREATE INDEX IF NOT EXISTS partnership_project_invitations_project_idx
  ON partnership_project_invitations (casting_project_id, status);


-- Audit-log for partnership-aktiviteter (audit + GDPR-bevisbarhet)
CREATE TABLE IF NOT EXISTS partnership_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id  UUID REFERENCES agency_production_partnerships(id) ON DELETE SET NULL,
  invitation_id   UUID REFERENCES partnership_project_invitations(id) ON DELETE SET NULL,
  actor_user_id   VARCHAR(255) REFERENCES users(id),
  action          VARCHAR(40) NOT NULL,   -- 'proposed', 'accepted', 'declined', 'revoked', 'project_invited', 'talent_proposed', etc
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partnership_audit_partnership_idx
  ON partnership_audit (partnership_id, created_at DESC);
CREATE INDEX IF NOT EXISTS partnership_audit_actor_idx
  ON partnership_audit (actor_user_id, created_at DESC);


-- updated_at-trigger for begge nye tabeller
CREATE OR REPLACE FUNCTION agency_production_partnerships_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_set_updated_at ON agency_production_partnerships;
CREATE TRIGGER app_set_updated_at
  BEFORE UPDATE ON agency_production_partnerships
  FOR EACH ROW EXECUTE FUNCTION agency_production_partnerships_set_updated_at();

DROP TRIGGER IF EXISTS ppi_set_updated_at ON partnership_project_invitations;
CREATE TRIGGER ppi_set_updated_at
  BEFORE UPDATE ON partnership_project_invitations
  FOR EACH ROW EXECUTE FUNCTION agency_production_partnerships_set_updated_at();
