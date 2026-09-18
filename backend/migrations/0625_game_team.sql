-- 0625_game_team.sql
-- Team-stack for spillstudio (Story Graph) — kopi av dans-modellen
-- (0071_dance_team_extension + 0072_dance_invite_pin) med egne tabeller.
-- Begrunnelse: dance_team_role er nøklet på eier-user_id uten org_kind, så en
-- eier med både dans og spill ville kollidere; dance-tjenesten hardkoder
-- dance_*-tabeller i ~15 SQL-strenger. Kopi (ikke generalisering) holder
-- den betalende dans-vertikalen urørt.
--
-- Modell:
--   • Studio-eier (casting_projects.created_by) eier teamet. Team-id =
--     eierens user_id = enterprise_team_members.organization_id, med
--     org_kind = 'game_studio'.
--   • game_team_role: custom roller med capability-sett (JSONB).
--   • enterprise_team_members.game_role_id → game_team_role.
--   • game_team_invite: magic-link + PIN (samme sikkerhetsmodell som dans).
--   • Seter: game_plan.limits.seats (Studio = 5), uten abonnement = 1.

CREATE TABLE IF NOT EXISTS game_team_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_organization_id VARCHAR(255) NOT NULL,
  label TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_owner_role BOOLEAN NOT NULL DEFAULT FALSE,
  is_default_for_invite BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT game_team_role_label_unique UNIQUE (team_organization_id, label)
);

CREATE INDEX IF NOT EXISTS idx_game_team_role_team
  ON game_team_role(team_organization_id, display_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_team_role_owner_unique
  ON game_team_role(team_organization_id) WHERE is_owner_role = TRUE;

COMMENT ON TABLE game_team_role IS
  'Custom roller per spillstudio (Story Graph). Seed: Eier / Produsent / Narrativ designer / Reviewer ved team-opprettelse.';
COMMENT ON COLUMN game_team_role.capabilities IS
  'Flat JSONB med capability-keys, f.eks. {"scenes.delete": true, "review.decide": false}. Ukjente keys ignoreres av app-laget.';

ALTER TABLE enterprise_team_members
  ADD COLUMN IF NOT EXISTS game_role_id UUID
    REFERENCES game_team_role(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_game_role
  ON enterprise_team_members(game_role_id) WHERE game_role_id IS NOT NULL;

COMMENT ON COLUMN enterprise_team_members.game_role_id IS
  'For org_kind=game_studio: peker på custom-rollen i game_team_role. NULL for andre org_kind.';

CREATE TABLE IF NOT EXISTS game_team_invite (
  token TEXT PRIMARY KEY,
  team_organization_id VARCHAR(255) NOT NULL,
  invited_email TEXT NOT NULL,
  invited_role_id UUID NOT NULL REFERENCES game_team_role(id) ON DELETE RESTRICT,
  invited_by_user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  accepted_at TIMESTAMPTZ,
  accepted_user_id VARCHAR(255) REFERENCES users(id),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- PIN-bekreftelse (GDPR-modus, som 0072)
  pin_hash TEXT,
  pin_sent_at TIMESTAMPTZ,
  pin_attempts INTEGER NOT NULL DEFAULT 0,
  pin_locked_at TIMESTAMPTZ,
  accepting_ip TEXT,
  accepting_user_agent TEXT,
  CONSTRAINT game_team_invite_pin_consistency CHECK (
    (pin_hash IS NULL AND pin_sent_at IS NULL)
    OR (pin_hash IS NOT NULL AND pin_sent_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_game_team_invite_team
  ON game_team_invite(team_organization_id, accepted_at);
CREATE INDEX IF NOT EXISTS idx_game_team_invite_pending_email
  ON game_team_invite(invited_email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

COMMENT ON TABLE game_team_invite IS
  'Invitasjoner til spillstudio-team (magic link /game/invite/<token> + PIN). Separat fra game_tester_invite.';
