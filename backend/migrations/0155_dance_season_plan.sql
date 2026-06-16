-- 0155_dance_season_plan.sql
-- Sesongplan for dans ("season"-fanen): en helårsplan med milepæler.
-- Designet (rr-dance-sesong) viser tittel + undertittel + en milepæl-tidslinje
-- (Sesongstart, Vinterforestilling, Turné, … ) med nådd/kommende-status og
-- en samlet fremdrift («milepæler nådd 2/5 · 26 %»).
--
-- Én rad per (owner, project). Milepæler ligger som JSONB-array for enkelhet:
--   [{ id, title, dateLabel, status: 'done'|'upcoming', icon? }]
-- dateLabel er fritekst ("2. september" / "Februar") siden noen er måned-grove.

CREATE TABLE IF NOT EXISTS dance_season (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  project_id TEXT,

  label TEXT NOT NULL,            -- "Sesong 2026 — Røtter & Røster"
  subtitle TEXT,                  -- "Helårsplan for kompani og elevgrupper"
  milestones JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Én aktiv sesongplan per (owner, project) — NULL project = følger danser/kompani.
CREATE UNIQUE INDEX IF NOT EXISTS dance_season_owner_project_uniq
  ON dance_season (owner_user_id, COALESCE(project_id, ''));
