-- 0071_dance_team_extension.sql
-- Custom-rolle-system for dans-vertikalens team-stack.
--
-- Modell:
--   • Studio-eier oppretter et team. enterprise_team_members.organization_id
--     = Studio-eierens user_id. Diskriminator: org_kind='dance_studio'.
--   • Studio-eier definerer egne roller (dance_team_role) med capability-sett
--     (Linear/Notion/GitHub-mønster). Default-roller seedes app-side når team
--     opprettes — ikke i denne migrationen, fordi de er user-bundet.
--   • Team-medlemmer er rader i enterprise_team_members med dance_role_id
--     som peker på en av studioets custom roller.
--   • Invitasjoner går via dance_team_invite (separat fra dance_tester_invite,
--     som er for prototype-tester-tilgang utenom Stripe).
--
-- Eksisterende role-kolonne på enterprise_team_members berøres ikke — den
-- beholder sin smale CHECK ('admin'|'member'|'viewer') og brukes som
-- coarse access-level. dance_role_id holder den fine-granulære rollen for
-- dans-team. Dette unngår å bryte eksisterende enterprise-kode.

-- ─── 1. Diskriminator-kolonne på enterprise_team_members ────────────
ALTER TABLE enterprise_team_members
  ADD COLUMN IF NOT EXISTS org_kind VARCHAR(32) NOT NULL DEFAULT 'enterprise';

CREATE INDEX IF NOT EXISTS idx_team_members_org_kind
  ON enterprise_team_members(org_kind, organization_id);

COMMENT ON COLUMN enterprise_team_members.org_kind IS
  'Diskriminator: enterprise (default), dance_studio. Filtrer queries per kind så ulike vertikaler ikke krasjer.';

-- ─── 2. Custom-rolle-tabell per dansestudio ─────────────────────────
CREATE TABLE IF NOT EXISTS dance_team_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Studio-eierens user_id (samme verdi som enterprise_team_members.organization_id)
  team_organization_id VARCHAR(255) NOT NULL,
  label TEXT NOT NULL,                       -- 'Hovedinstruktør', 'Repetitør', etc
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Eier-rollen er locked: kan ikke slettes, alltid alle capabilities.
  is_owner_role BOOLEAN NOT NULL DEFAULT FALSE,
  -- Markerer at denne rollen er forhåndsvalgt i InviteDialog.
  is_default_for_invite BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dance_team_role_label_unique
    UNIQUE (team_organization_id, label)
);

CREATE INDEX IF NOT EXISTS idx_dance_team_role_team
  ON dance_team_role(team_organization_id, display_order);

-- Bare én eier-rolle per team.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dance_team_role_owner_unique
  ON dance_team_role(team_organization_id) WHERE is_owner_role = TRUE;

COMMENT ON TABLE dance_team_role IS
  'Custom roller per dansestudio. Studio-eier definerer disse selv — system har ingen hardkodede dance-roller utover en seed (Eier/Lærer/Koreograf/Danser) som settes inn ved team-opprettelse.';
COMMENT ON COLUMN dance_team_role.capabilities IS
  'Flat JSONB med capability-keys som dotted strings, f.eks. {"team.invite_members": true, "billing.view": false, "choreography.edit_all": true}. Ukjente keys ignoreres av app-laget.';

-- ─── 3. Link team-medlem → custom rolle (kun for dance_studio) ──────
ALTER TABLE enterprise_team_members
  ADD COLUMN IF NOT EXISTS dance_role_id UUID
    REFERENCES dance_team_role(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_dance_role
  ON enterprise_team_members(dance_role_id) WHERE dance_role_id IS NOT NULL;

COMMENT ON COLUMN enterprise_team_members.dance_role_id IS
  'For org_kind=dance_studio: peker på custom-rollen i dance_team_role. NULL for andre org_kind.';

-- ─── 4. Invitasjons-tabell for dans-team-medlemmer ──────────────────
CREATE TABLE IF NOT EXISTS dance_team_invite (
  token TEXT PRIMARY KEY,
  team_organization_id VARCHAR(255) NOT NULL,
  invited_email TEXT NOT NULL,
  invited_role_id UUID NOT NULL REFERENCES dance_team_role(id) ON DELETE RESTRICT,
  invited_by_user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  -- Default 14-dagers utløp; kan overstyres ved invite-opprettelse.
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  accepted_at TIMESTAMPTZ,
  accepted_user_id VARCHAR(255) REFERENCES users(id),
  revoked_at TIMESTAMPTZ,                    -- Studio-eier kan trekke en pending invite
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dance_team_invite_team
  ON dance_team_invite(team_organization_id, accepted_at);
CREATE INDEX IF NOT EXISTS idx_dance_team_invite_pending_email
  ON dance_team_invite(invited_email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

COMMENT ON TABLE dance_team_invite IS
  'Invitasjoner til dans-team-medlemskap. Separat fra dance_tester_invite (som er prototype-tester-tilgang utenom Stripe).';
