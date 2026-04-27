-- 0063_dance_formation.sql
-- Formations — navngitte øyeblikksbilder av dansernes plassering på scenen.
-- Brukes av FormationView, og refereres senere fra
-- dance_choreography_segment via et formation_id-felt (Slice 1.5+).
--
-- Scoping: per (owner_user_id, project_id). project_id NULL =
-- formasjonen er en bibliotek-formasjon synlig på tvers av prosjekter
-- (samme mønster som dance_choreography 0060 og dancer_profile_extras 0061).
--
-- transition_from_id er en valgfri self-reference som beskriver "kommer
-- fra denne formasjonen" — brukes til å animere A→B-overganger.

CREATE TABLE IF NOT EXISTS dance_formation (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  project_id TEXT,

  label TEXT NOT NULL,
  notes TEXT,

  -- Scene-dimensjoner i meter. Default = proscenium ~12×8m.
  stage_width_m NUMERIC(5,2) NOT NULL DEFAULT 12.00,
  stage_depth_m NUMERIC(5,2) NOT NULL DEFAULT 8.00,

  -- Posisjoner: [{ dancerId, x, y, facing?, isLead? }] hvor x/y er
  -- normalisert 0..1 (0 = stage left/back, 1 = stage right/front).
  dancer_positions JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Self-reference (uten FK-constraint så vi kan slette i hvilken som
  -- helst rekkefølge). NULL = formasjon har ingen kjent forgjenger.
  transition_from_id TEXT,

  -- Brukerens ønskede rekkefølge i lista. Synkende sortering.
  display_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hot path: list per (owner, project), sortert etter display_order.
CREATE INDEX IF NOT EXISTS dance_formation_owner_project_idx
  ON dance_formation (owner_user_id, project_id, display_order, updated_at DESC);

-- Når bruker velger "kommer fra X" i editoren ser vi opp transition.
CREATE INDEX IF NOT EXISTS dance_formation_transition_from_idx
  ON dance_formation (transition_from_id);
