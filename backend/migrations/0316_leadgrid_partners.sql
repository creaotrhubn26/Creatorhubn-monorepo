-- 0316_leadgrid_partners.sql
-- Dynamisk samarbeidspartner-liste for landingssiden.
-- Drevet av Daniels feedback: navnene som vises på /leadgrid skal
-- være kunder vi faktisk har samtykke fra, ikke hardkodet.
--
-- partner_type:
--   customer      - kunde-org som har gitt logo-tillatelse
--   integration   - 3rd-party-system m/ API-integrasjon (krever Partners-API)
--   reseller      - byrå som videreselger Leadgrid
--   strategic     - større partnerskap (e.g. Brønnøysund, MedTech-clusters)
CREATE TABLE IF NOT EXISTS leadgrid_partners (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(120) NOT NULL,
  slug            VARCHAR(120) UNIQUE,
  logo_url        TEXT,
  website         VARCHAR(300),
  tagline         VARCHAR(200),
  partner_type    VARCHAR(40) NOT NULL DEFAULT 'customer'
                  CHECK (partner_type IN ('customer','integration','reseller','strategic')),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  display_order   INT NOT NULL DEFAULT 100,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  show_on_landing BOOLEAN NOT NULL DEFAULT TRUE,
  consent_at      TIMESTAMPTZ,
  consent_source  VARCHAR(60),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_partners_landing
  ON leadgrid_partners (display_order, is_active)
  WHERE is_active = TRUE AND show_on_landing = TRUE;
CREATE INDEX IF NOT EXISTS idx_leadgrid_partners_org
  ON leadgrid_partners (organization_id);
