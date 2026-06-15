-- 277_audio_warmups.sql
--
-- «Oppvarming & fokus»: produsenten tilordner oppvarmingsrutiner (vokal/instrument/
-- mindfulness) til band/vokalist før opptak. Medlemmet kjører en guidet flyt og
-- markerer fullført, så produsenten ser hvem som er klar.

CREATE TABLE IF NOT EXISTS audio_warmup_routines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES audio_review_projects(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  title         TEXT NOT NULL,
  -- 'all' | 'vocalist' | 'instrument' | rolle-tekst
  target        TEXT NOT NULL DEFAULT 'all',
  -- [{ title, type, durationSec, instruction, tone }]
  steps         JSONB NOT NULL DEFAULT '[]'::jsonb,
  note          TEXT,                 -- valgfri personlig beskjed fra produsent
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warmup_routines_project ON audio_warmup_routines (project_id);

CREATE TABLE IF NOT EXISTS audio_warmup_completions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id   UUID NOT NULL REFERENCES audio_warmup_routines(id) ON DELETE CASCADE,
  member_name  TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (routine_id, member_name)
);
