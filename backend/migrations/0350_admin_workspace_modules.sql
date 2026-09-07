-- 0350_admin_workspace_modules.sql
--
-- Fyller de siste hullene i AdminWorkspace. Flatene Prosjekter,
-- Dokumenter, Filer, Kundeprosjekt og Automatiseringer bygges på
-- tabeller som allerede finnes (casting_projects, role_room_user_files,
-- workspace_participant_documents, automations, …) og trenger ingen
-- migrasjon. To flater manglet datamodell helt, og får den her:
--
--   1. Teamchat — workspace-bred chat. Fantes bare per prosjekt
--      (/api/role-room/projects/:projectId/messages), så panelet viste en
--      låst composer. Nå: kanaler + meldinger på workspace-nivå.
--
--   2. HR — team-medlemmer, engasjement og fravær. EmptyState-TODO-en ba
--      eksplisitt om et datamodell-valg. Vi holder det minimalt og
--      knytter valgfritt mot users(id), slik at et medlem kan være en
--      ekte innlogget bruker ELLER en ekstern frilanser uten konto.
--
-- I tillegg: en liten nøkkel/verdi-tabell for workspace-innstillinger,
-- som gjør Innstillinger-flaten til noe annet enn en lenkesamling.

-- ── Teamchat ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_workspace_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  -- Stabil nøkkel for default-kanaler ('general'), NULL for egendefinerte.
  channel_key VARCHAR(64),
  name VARCHAR(120) NOT NULL,
  description TEXT,
  -- 'role_room' | 'leadgrid' | NULL (intern/på tvers)
  product_key VARCHAR(32),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Én kanal per (bruker, nøkkel) så default-kanaler ikke dupliseres av
-- samtidige requests som begge prøver å opprette 'general'.
CREATE UNIQUE INDEX IF NOT EXISTS admin_workspace_channels_user_key_idx
  ON admin_workspace_channels (user_id, channel_key)
  WHERE channel_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS admin_workspace_channels_user_idx
  ON admin_workspace_channels (user_id, is_archived, created_at);

CREATE TABLE IF NOT EXISTS admin_workspace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES admin_workspace_channels(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  author_name VARCHAR(160),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS admin_workspace_messages_channel_idx
  ON admin_workspace_messages (channel_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ── HR: team-medlemmer, engasjement og fravær ─────────────────────

CREATE TABLE IF NOT EXISTS admin_workspace_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Eieren av workspacet (samme user_id-mønster som cases/funding).
  owner_user_id VARCHAR(255) NOT NULL,
  -- Valgfri kobling til en ekte konto. Frilansere uten konto har NULL.
  member_user_id VARCHAR(255),
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(255),
  role_title VARCHAR(120),
  -- 'employee' | 'freelancer' | 'contractor' | 'advisor' | 'intern'
  engagement_type VARCHAR(32) NOT NULL DEFAULT 'freelancer',
  -- 'role_room' | 'leadgrid' | NULL (på tvers)
  product_key VARCHAR(32),
  -- 'active' | 'onboarding' | 'paused' | 'ended'
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  started_on DATE,
  ended_on DATE,
  hourly_rate NUMERIC(10, 2),
  currency VARCHAR(10) NOT NULL DEFAULT 'NOK',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_workspace_team_members_owner_idx
  ON admin_workspace_team_members (owner_user_id, status);

CREATE TABLE IF NOT EXISTS admin_workspace_team_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES admin_workspace_team_members(id) ON DELETE CASCADE,
  -- 'vacation' | 'sick' | 'parental' | 'unavailable' | 'other'
  absence_type VARCHAR(32) NOT NULL DEFAULT 'vacation',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  note VARCHAR(400),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_workspace_team_absences_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS admin_workspace_team_absences_member_idx
  ON admin_workspace_team_absences (member_id, start_date DESC);

-- ── Workspace-innstillinger ───────────────────────────────────────
-- Nøkkel/verdi per bruker. Holder Innstillinger-flaten ekte (den lagrer
-- noe) uten å låse oss til et skjema før vi vet hvilke valg som trengs.

CREATE TABLE IF NOT EXISTS admin_workspace_settings (
  user_id VARCHAR(255) NOT NULL,
  setting_key VARCHAR(80) NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, setting_key),
  CONSTRAINT admin_workspace_settings_value_object
    CHECK (jsonb_typeof(setting_value) = 'object')
);
