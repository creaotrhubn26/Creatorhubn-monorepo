-- 0061_dancer_profile_extras.sql
-- Dancer Profiles — owner-scoped lagring av dans-spesifikke felt for hver
-- danser i dans-vertikalen (The Role Room).
--
-- Hver rad er en (owner_user_id, dancer_id)-kombinasjon. `dancer_id` er en
-- stabil string-nøkkel — typisk samme som `Dancer.id` i frontend
-- (DEMO_DANCERS) eller en CrewMember.id når CrewMember er DB-persistert.
-- Vi krever ikke at `dancer_id` finnes som FK i en annen tabell, fordi
-- CrewMember-modellen i denne kodebasen kan være tilstede både som
-- frontend-fixture og som DB-rad avhengig av deploy.
--
-- Scoping: `project_id` er valgfri. NULL = profil er synlig på tvers av
-- prosjekter (samme mønster som dance_choreography 0060). Når `projectId`
-- angis i listing-API, returneres rader der `project_id = $projectId OR
-- project_id IS NULL`.

CREATE TABLE IF NOT EXISTS dancer_profile_extras (
  -- Eierskap
  owner_user_id TEXT NOT NULL,
  dancer_id TEXT NOT NULL,

  -- Visningsnavn (NULL om vi heller leser fra CrewMember.name).
  display_name TEXT,

  -- Kropp
  height_cm INTEGER,

  -- Hoved-dansestil — matcher `DanceStyle`-enum i dancerProfile.ts.
  primary_style TEXT,

  -- Korte styrke-tags (eks: "turns", "leaps", "musicality").
  strengths JSONB DEFAULT '[]'::jsonb,

  -- Tilgjengelighets-vinduer som array av { from, to, note? } (ISO datetime).
  availability_windows JSONB DEFAULT '[]'::jsonb,

  -- Skadestatus
  injury_status TEXT DEFAULT 'healthy',
  injury_note TEXT,

  -- Reel-URLer (Vimeo/YouTube etc).
  reel_urls JSONB DEFAULT '[]'::jsonb,

  -- Body measurements (extensible). Forventede nøkler:
  --   inseam_cm, reach_cm, weight_kg, shoe_size
  body_measurements JSONB DEFAULT '{}'::jsonb,

  -- Skill levels per kategori.
  --   keys: turns, leaps, lifts, partnering, improv, musicality, floorwork
  --   values: 'beginner' | 'intermediate' | 'advanced' | 'pro'
  skill_levels JSONB DEFAULT '{}'::jsonb,

  -- Fritekst-notater (privat for owner).
  notes TEXT,

  -- Valgfri scoping. NULL = synlig på tvers av prosjekter.
  project_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (owner_user_id, dancer_id)
);

-- Lookup-indeks for liste-spørringer per (owner, project).
CREATE INDEX IF NOT EXISTS dancer_profile_extras_owner_project_idx
  ON dancer_profile_extras (owner_user_id, project_id);
