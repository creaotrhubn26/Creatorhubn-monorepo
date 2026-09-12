-- 0385: Utstyrsregister (2026-07-17). Daniel: «Profil utstyr — nettbrett,
-- telefon, laptop, klær, ID-kort … utstyr som er fra organisasjonen som
-- teamledere og selgere har.»
--
-- Org-eid utstyr m/ tildeling til medlemmer + full hendelseslogg (hvem
-- hadde hva når — viktig ved offboarding). Selger ser SITT utstyr i Min
-- profil; admin/salgssjef/teamleder administrerer registeret fra Team.

CREATE TABLE IF NOT EXISTS leadgrid_equipment (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  kind TEXT NOT NULL,                    -- nettbrett|telefon|laptop|klaer|id_kort|annet
  label TEXT NOT NULL,                   -- «iPad Pro 11"», «Vinterjakke», «ID-kort #042»
  serial_number TEXT,                    -- serienr/IMEI/asset-tag (valgfri)
  size TEXT,                             -- klesstørrelse o.l. (valgfri)
  status TEXT NOT NULL DEFAULT 'tilgjengelig',  -- tilgjengelig|utlevert|tapt|defekt|kassert
  assigned_user_id TEXT,
  assigned_user_name TEXT NOT NULL DEFAULT '',
  assigned_at TIMESTAMPTZ,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lg_equipment_org
  ON leadgrid_equipment (organization_id, status, kind);
CREATE INDEX IF NOT EXISTS idx_lg_equipment_assignee
  ON leadgrid_equipment (organization_id, assigned_user_id)
  WHERE assigned_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS leadgrid_equipment_events (
  id UUID PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES leadgrid_equipment(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  event TEXT NOT NULL,                   -- opprettet|utlevert|innlevert|tapt|defekt|kassert|endret
  subject_user_id TEXT,                  -- den utstyret gjelder (v/ utlevert/innlevert)
  subject_user_name TEXT NOT NULL DEFAULT '',
  actor_user_id TEXT,
  actor_name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lg_equipment_events
  ON leadgrid_equipment_events (equipment_id, created_at DESC);
