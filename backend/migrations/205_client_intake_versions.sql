-- 205_client_intake_versions.sql
-- Versjonering for klient-intake (research). I dag overskriver hver
-- INSERT … ON CONFLICT (project_id) DO UPDATE forrige verdi, så
-- historien går tapt. Innholdsprodusenten må kunne se gamle versjoner
-- og rulle tilbake hvis Agent re-genererer noe han ikke liker.
--
-- Strategi:
--   - role_room_client_intake forblir "aktiv-versjon-pointer" — hver
--     lesning treffer fortsatt samme tabell, så ingen frontend endres.
--   - Hver write skriver i tillegg en snapshot til _versions-tabellen.
--   - Klient-portal-routen og admin-UI kan liste versjoner + rulle
--     tilbake via en switch-active-endpoint.

CREATE TABLE IF NOT EXISTS role_room_client_intake_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  label TEXT,
  -- Snapshot av hele intake-raden ved tidspunktet for lagring. Vi
  -- lagrer som JSONB slik at fremtidige kolonne-endringer ikke
  -- bryter eksisterende snapshots.
  snapshot JSONB NOT NULL,
  generated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- 'user' når innholdsprodusenten editerer manuelt, 'agent' når
  -- Role Room Agent skriver fra research-flowen.
  generated_by_kind TEXT NOT NULL DEFAULT 'user'
    CHECK (generated_by_kind IN ('user', 'agent')),
  -- Markerer hvilken versjon som er live. Én pr prosjekt.
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, version_number)
);

CREATE INDEX IF NOT EXISTS role_room_client_intake_versions_project_idx
  ON role_room_client_intake_versions (project_id, version_number DESC);

-- Maks én aktiv versjon pr prosjekt (partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS role_room_client_intake_versions_active_idx
  ON role_room_client_intake_versions (project_id)
  WHERE is_active = TRUE;

COMMENT ON TABLE role_room_client_intake_versions IS
  'Append-only historikk for research/intake. Hver lagring legger ny rad. is_active=true markerer hvilken som er live i role_room_client_intake.';
