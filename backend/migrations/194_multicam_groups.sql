-- Multi-cam sync-grupper per prosjekt. Hver gruppe inneholder 2+
-- kameraer/lyd-recordere synket til en felles tidslinje med
-- offset per clip (detektert via audio cross-correlation + optional
-- manual finetune).
--
-- Brukes for Wedding/Event/Podcast/Documentary/Short Film/Music Video
-- multi-cam-redigering. Eksporteres som multicam-clip i Resolve XML
-- handoff.

CREATE TABLE IF NOT EXISTS role_room_multicam_groups (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  project_id text NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  -- Hele clips-arrayen som JSONB. UI eier shape:
  -- [{ id, filePath, fileName, isReference, detectedOffsetSec,
  --    manualOffsetSec, confidence, durationSec, waveformData[] }]
  clips jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Hvilken agent som opprettet gruppen — for å filtrere "vis bare
  -- mine" og for context-rangering
  agent_kind text,
  -- Sync-status: pending (lagt til klipp, ikke kjørt sync) | syncing |
  -- ready | failed
  sync_status text NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'syncing', 'ready', 'failed')),
  sync_error text,
  sync_method text, -- 'scipy-correlate' | 'numpy-correlate' | 'fallback'
  last_synced_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_multicam_project
  ON role_room_multicam_groups(project_id, updated_at DESC);

COMMENT ON TABLE role_room_multicam_groups IS
  'Per-prosjekt multi-cam sync-grupper med offset-data per kamera. '
  'Detektert via audio cross-correlation, justerbar manuelt, '
  'eksporteres som multicam-clips i Resolve XML handoff.';
