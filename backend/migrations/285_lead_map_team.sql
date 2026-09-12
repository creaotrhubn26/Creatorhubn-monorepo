-- 285_lead_map_team.sql
--
-- To-nivå tilgangs-modell for Lead Map med salgs-hierarki + profiler:
--
--   Organization (org-nivå profil)
--     ├─ Team (Salgsteam, ledet av Teamleder)
--     │   └─ Salgskonsulenter, Promotører
--     └─ Project (prosjekt-nivå)
--          └─ Leads, Konkurrenter, Brand Kit, Market Scan
--
-- Salgs-roller (i tillegg til standard admin/member/viewer):
--   admin           — eier/utvikler-rolle (full kontroll)
--   salgssjef       — leder for hele salgsorganisasjonen
--   teamleder       — leder for et salgs-team
--   salgskonsulent  — selger leads, jobber i team
--   promotor        — promoterer på event/feltarbeid
--   member          — generisk skrive-tilgang
--   viewer          — kun lesing
--
-- Profiler:
--   - organizations: utvidet med profile-felter (description, website,
--     industry, address, phone, etc.)
--   - user_profiles: rik profil per bruker UNDER organisasjon
--     (tittel, telefon, foto, territorium, m.m.)
--
-- Seed:
--   Creatorhub AS opprettes som første organisasjon (developer-org).
--   Daniel blir admin. Eksisterende prosjekter knyttes til Creatorhub AS.

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- Organizations (med utvidet profil)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(80) UNIQUE,
  -- Plan: 'free', 'pro', 'enterprise', 'internal' (Creatorhub AS)
  plan VARCHAR(40) NOT NULL DEFAULT 'free',
  -- 'developer' = utvikleren av Lead Map (Creatorhub AS)
  org_type VARCHAR(40) NOT NULL DEFAULT 'customer'
    CHECK (org_type IN ('customer', 'developer', 'agency')),
  owner_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  -- ── Profil ──
  description TEXT,
  website VARCHAR(300),
  industry VARCHAR(100),
  org_number VARCHAR(40),               -- BRREG-nummer
  phone VARCHAR(40),
  contact_email VARCHAR(200),
  address_line VARCHAR(300),
  postal_code VARCHAR(20),
  city VARCHAR(100),
  country VARCHAR(80) DEFAULT 'Norge',
  -- ── Branding ──
  logo_url TEXT,
  brand_color VARCHAR(20),
  -- ── Billing ──
  stripe_customer_id VARCHAR(200),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner
  ON organizations (owner_user_id);

-- Idempotente kolonne-tilføyelser hvis tabellen finnes fra før
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS website VARCHAR(300),
  ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
  ADD COLUMN IF NOT EXISTS org_number VARCHAR(40),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(40),
  ADD COLUMN IF NOT EXISTS contact_email VARCHAR(200),
  ADD COLUMN IF NOT EXISTS address_line VARCHAR(300),
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country VARCHAR(80) DEFAULT 'Norge';

-- ─────────────────────────────────────────────────────────────────
-- Sales-teams (Teamleder → Salgskonsulenter/Promotører)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  -- Teamleder
  team_lead_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  -- Territorium / fokus
  territory VARCHAR(200),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_teams_org
  ON sales_teams (organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_teams_lead
  ON sales_teams (team_lead_user_id);

-- ─────────────────────────────────────────────────────────────────
-- Organization members (med utvidet rolle-enum)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'member'
    CHECK (role IN (
      'admin', 'salgssjef', 'teamleder',
      'salgskonsulent', 'promotor',
      'member', 'viewer'
    )),
  -- Salgskonsulenter/Promotører kan tilhøre ett team
  sales_team_id UUID REFERENCES sales_teams(id) ON DELETE SET NULL,
  invited_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  UNIQUE (organization_id, user_id)
);

-- Hvis tabellen finnes fra før: utvid role CHECK + legg til sales_team_id
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS sales_team_id UUID
    REFERENCES sales_teams(id) ON DELETE SET NULL;

DO $$
BEGIN
  ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
  ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
    CHECK (role IN (
      'admin', 'salgssjef', 'teamleder',
      'salgskonsulent', 'promotor',
      'member', 'viewer'
    ));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_org_members_user
  ON organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org
  ON organization_members (organization_id, role);
CREATE INDEX IF NOT EXISTS idx_org_members_team
  ON organization_members (sales_team_id) WHERE sales_team_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- User profiles (rik profil for bruker UNDER organisasjon)
-- ─────────────────────────────────────────────────────────────────
-- En bruker kan ha forskjellig profil i forskjellige organisasjoner
-- (f.eks. forskjellig tittel/territorium hos forskjellige byråer)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  -- Visnings-felter
  display_name VARCHAR(200),
  title VARCHAR(150),             -- "Salgssjef Nord-Norge", etc.
  bio TEXT,
  avatar_url TEXT,
  -- Kontakt
  phone VARCHAR(40),
  contact_email VARCHAR(200),
  linkedin_url VARCHAR(300),
  -- Salgs-felter
  territory VARCHAR(200),         -- f.eks. "Oslo + Akershus"
  quota_monthly_nok NUMERIC(14,2),
  quota_currency VARCHAR(8) DEFAULT 'NOK',
  commission_pct NUMERIC(5,2),    -- f.eks. 8.50 for 8.5%
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user
  ON user_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_org
  ON user_profiles (organization_id);

-- ─────────────────────────────────────────────────────────────────
-- Koble eksisterende prosjekter til organisasjon
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE casting_projects
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_organization
  ON casting_projects (organization_id);

-- ─────────────────────────────────────────────────────────────────
-- Per-prosjekt-medlemmer (for eksterne uten org-medlemskap)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL
    REFERENCES casting_projects(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'salgskonsulent', 'promotor', 'member', 'viewer')),
  invited_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (project_id, user_id)
);

DO $$
BEGIN
  ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_role_check;
  ALTER TABLE project_members ADD CONSTRAINT project_members_role_check
    CHECK (role IN ('owner', 'salgskonsulent', 'promotor', 'member', 'viewer'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_members_user
  ON project_members (user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project
  ON project_members (project_id);

-- ─────────────────────────────────────────────────────────────────
-- Invitations (org-nivå OR prosjekt-nivå)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nøyaktig én av disse er satt
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id VARCHAR(255) REFERENCES casting_projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'member'
    CHECK (role IN (
      'admin', 'salgssjef', 'teamleder',
      'salgskonsulent', 'promotor',
      'owner', 'member', 'viewer'
    )),
  -- Hvis invitasjonen er for en salgsrolle: hvilket team
  sales_team_id UUID REFERENCES sales_teams(id) ON DELETE SET NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  invited_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  email_status VARCHAR(40),
  email_provider_message_id VARCHAR(200),
  CONSTRAINT inv_target_exactly_one
    CHECK ((organization_id IS NOT NULL)::int + (project_id IS NOT NULL)::int = 1)
);

ALTER TABLE project_invitations
  ADD COLUMN IF NOT EXISTS sales_team_id UUID
    REFERENCES sales_teams(id) ON DELETE SET NULL;

DO $$
BEGIN
  ALTER TABLE project_invitations DROP CONSTRAINT IF EXISTS project_invitations_role_check;
  ALTER TABLE project_invitations ADD CONSTRAINT project_invitations_role_check
    CHECK (role IN (
      'admin', 'salgssjef', 'teamleder',
      'salgskonsulent', 'promotor',
      'owner', 'member', 'viewer'
    ));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_invitations_org
  ON project_invitations (organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_project
  ON project_invitations (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_email_pending
  ON project_invitations (LOWER(email))
  WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_token
  ON project_invitations (token)
  WHERE accepted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────
-- Seed: Creatorhub AS som første organisasjon (utvikler-org)
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  ch_org_id UUID;
  daniel_user_id VARCHAR(255);
BEGIN
  -- Hopp over hvis allerede seedet
  IF EXISTS (SELECT 1 FROM organizations WHERE slug = 'creatorhub-as') THEN
    RETURN;
  END IF;

  -- Finn Daniels user-id
  SELECT id INTO daniel_user_id
    FROM users
   WHERE LOWER(email) = 'daniel@creatorhubn.com'
   LIMIT 1;

  -- Opprett org med profil
  INSERT INTO organizations (
    name, slug, plan, org_type, owner_user_id,
    description, website, contact_email, country,
    meta
  )
  VALUES (
    'Creatorhub AS',
    'creatorhub-as',
    'internal',
    'developer',
    daniel_user_id,
    'Utvikler og eier av Lead Map og The Role Room — operativsystem for film, kreativt arbeid og målbart kunde-innsalg.',
    'https://theroleroom.com',
    'daniel@creatorhubn.com',
    'Norge',
    jsonb_build_object(
      'is_default_developer_org', true,
      'launched', '2026'
    )
  )
  RETURNING id INTO ch_org_id;

  -- Daniel som admin
  IF daniel_user_id IS NOT NULL THEN
    INSERT INTO organization_members (organization_id, user_id, role, invited_by)
    VALUES (ch_org_id, daniel_user_id, 'admin', daniel_user_id);

    -- User profile for Daniel under Creatorhub AS
    INSERT INTO user_profiles (
      user_id, organization_id,
      display_name, title, bio, contact_email
    ) VALUES (
      daniel_user_id, ch_org_id,
      'Daniel Qazi',
      'Grunnlegger & Produktleder',
      'Solo-lead bak Lead Map og The Role Room.',
      'daniel@creatorhubn.com'
    )
    ON CONFLICT (user_id, organization_id) DO NOTHING;
  END IF;

  -- Backfill: Daniels prosjekter kobles til Creatorhub AS
  IF daniel_user_id IS NOT NULL THEN
    UPDATE casting_projects
       SET organization_id = ch_org_id
     WHERE created_by = daniel_user_id
       AND organization_id IS NULL;
  END IF;
END $$;

-- Backfill: Hver casting_project sin created_by blir owner på prosjekt-nivå
INSERT INTO project_members (project_id, user_id, role, invited_by, invited_at)
SELECT
  cp.id,
  cp.created_by,
  'owner',
  cp.created_by,
  cp.created_at
FROM casting_projects cp
WHERE cp.created_by IS NOT NULL
  AND EXISTS (SELECT 1 FROM users u WHERE u.id = cp.created_by)
ON CONFLICT (project_id, user_id) DO NOTHING;

COMMIT;
