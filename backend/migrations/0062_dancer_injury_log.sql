-- 0062_dancer_injury_log.sql
-- Skadelogg for dansere — brukes av "injuries"-fanen i DanceWorkspace.
--
-- Hver rad er en skade-hendelse. En danser kan ha flere oppføringer
-- (samme dancer_id, ulike datoer eller body_part). Status går typisk
-- 'active' → 'healing' → 'resolved'. NAV-søknad-generator (Slice 2)
-- vil lese aktive/avsluttede skader sammen med gigg-historikk.
--
-- Scoping: per (owner_user_id, project_id). project_id NULL =
-- skadeloggen følger danseren på tvers av prosjekter (samme mønster
-- som dancer_profile_extras 0061).

CREATE TABLE IF NOT EXISTS dancer_injury_log (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  dancer_id TEXT NOT NULL,

  -- Når skaden oppsto (dato, ikke datetime — klienten sender ISO date).
  entry_date DATE NOT NULL,

  -- Hvilken kroppsdel: 'ankle', 'knee', 'hip', 'lower_back', 'shoulder',
  -- 'wrist', 'foot', 'neck', 'other'. Vi holder det som TEXT for
  -- fleksibilitet; klienten validerer mot et enum.
  body_part TEXT NOT NULL,

  -- Side: 'left' | 'right' | 'both' | NULL.
  side TEXT,

  -- 1 (mild irritasjon) … 5 (alvorlig — krever lege/operasjon).
  severity SMALLINT NOT NULL DEFAULT 1,

  -- Hva skjedde. Fritekst, brukes også som NAV-søknadsgrunnlag.
  note TEXT,

  -- 'active' | 'healing' | 'resolved'.
  status TEXT NOT NULL DEFAULT 'active',

  -- Forventet retur til full belastning. NULL hvis ukjent.
  expected_return_date DATE,

  -- Faktisk retur — settes når status går til 'resolved'.
  resolved_date DATE,

  -- Hvilken hendelse skadet danseren? F.eks. 'rehearsal',
  -- 'performance', 'audition', 'training', 'other'. NULL hvis ukjent.
  triggered_by TEXT,

  -- Valgfri scoping. NULL = følger danseren på tvers av prosjekter.
  project_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dancer_injury_log_severity_range CHECK (severity BETWEEN 1 AND 5),
  CONSTRAINT dancer_injury_log_status_values CHECK (status IN ('active','healing','resolved'))
);

-- Liste-spørring per (owner, dancer): vis nyeste først.
CREATE INDEX IF NOT EXISTS dancer_injury_log_owner_dancer_idx
  ON dancer_injury_log (owner_user_id, dancer_id, entry_date DESC);

-- Liste-spørring per (owner, project): brukes når injury-fanen åpnes.
CREATE INDEX IF NOT EXISTS dancer_injury_log_owner_project_idx
  ON dancer_injury_log (owner_user_id, project_id, entry_date DESC);

-- Aktive skader er hot-path for "hvem er ute akkurat nå" — egen idx.
CREATE INDEX IF NOT EXISTS dancer_injury_log_owner_active_idx
  ON dancer_injury_log (owner_user_id, status)
  WHERE status IN ('active','healing');
