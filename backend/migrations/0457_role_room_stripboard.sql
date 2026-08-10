-- 0457_role_room_stripboard.sql
--
-- Del A punkt 72 (stripboard), 84 (sider per scene), 87 (skutt/ikke skutt) og
-- dermed grunnlaget for 73 (fremdriftslogg).
--
-- Alle fire ventet på at scener skulle finnes som data (punkt 82). Nå gjør de
-- det, og da faller resten på plass: et stripboard er scener fordelt på dager,
-- fremdrift er hvor mange av dem som er skutt, og begge deler måles i sider.
--
-- **Sider måles i åttedeler.** Det er bransjestandarden — en scene er «2 og
-- 3/8 side», ikke «2,375 sider». Vi lagrer hele åttedeler som heltall og lar
-- visningen formatere, fordi desimaltall ville invitert til presisjon som
-- ikke finnes i målemetoden.

-- ── Punkt 84: sidelengde ─────────────────────────────────────────────────

ALTER TABLE casting_scenes
  ADD COLUMN IF NOT EXISTS page_eighths INTEGER CHECK (page_eighths IS NULL OR page_eighths >= 0);

COMMENT ON COLUMN casting_scenes.page_eighths IS
  'Scenens lengde i åttedels sider (8 = én side). Bransjestandard for dagsplanlegging.';

-- ── Punkt 87: skutt-status ───────────────────────────────────────────────
-- «omitted» er ikke det samme som «ikke skutt ennå»: en strøket scene skal
-- ikke telle med i det som gjenstår.

ALTER TABLE casting_scenes
  ADD COLUMN IF NOT EXISTS shoot_status VARCHAR(20) NOT NULL DEFAULT 'not_shot',
  ADD COLUMN IF NOT EXISTS shot_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS take_count   INTEGER NOT NULL DEFAULT 0 CHECK (take_count >= 0);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'casting_scenes_shoot_status_vocab') THEN
    ALTER TABLE casting_scenes
      ADD CONSTRAINT casting_scenes_shoot_status_vocab
      CHECK (shoot_status IN ('not_shot','partial','shot','omitted'));
  END IF;
END $$;

COMMENT ON COLUMN casting_scenes.shoot_status IS
  'not_shot | partial | shot | omitted. Strøkne scener teller ikke som gjenstående arbeid.';

CREATE INDEX IF NOT EXISTS idx_casting_scenes_shoot_status
  ON casting_scenes (project_id, shoot_status);

-- ── Punkt 72: stripboard ─────────────────────────────────────────────────
-- Én rad per scene per dag. Egen tabell framfor scene_ids-arrayen på
-- produksjonsdagen, fordi rekkefølgen INNAD i dagen er selve planleggingen —
-- og fordi en scene kan måtte skytes over to dager.

CREATE TABLE IF NOT EXISTS role_room_stripboard_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  scene_id          VARCHAR(255) NOT NULL REFERENCES casting_scenes(id) ON DELETE CASCADE,

  -- NULL = scenen ligger i «ikke planlagt»-bunken. Det er en gyldig og
  -- vanlig tilstand tidlig i planleggingen, ikke en feil.
  production_day_id VARCHAR(255) REFERENCES casting_production_days(id) ON DELETE SET NULL,

  -- Rekkefølgen scenen skytes i den dagen.
  sort_order        INTEGER NOT NULL DEFAULT 0,

  -- Rigge-/flyttetid før scenen. Det er dette som gjør at en dag med seks
  -- korte scener på seks steder er verre enn én lang scene på ett.
  setup_minutes     INTEGER NOT NULL DEFAULT 0 CHECK (setup_minutes >= 0),

  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- En scene kan ligge på flere dager (delt scene), men ikke to ganger på
  -- samme dag.
  CONSTRAINT rr_stripboard_scene_day_unique UNIQUE (scene_id, production_day_id)
);

CREATE INDEX IF NOT EXISTS idx_rr_stripboard_day
  ON role_room_stripboard_entries (production_day_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_rr_stripboard_project
  ON role_room_stripboard_entries (project_id);
-- «Hva er ikke planlagt ennå» — bunken som skal tømmes.
CREATE INDEX IF NOT EXISTS idx_rr_stripboard_unscheduled
  ON role_room_stripboard_entries (project_id)
  WHERE production_day_id IS NULL;

COMMENT ON TABLE role_room_stripboard_entries IS
  'Scener fordelt på opptaksdager (Del A punkt 72). production_day_id NULL = ikke planlagt ennå.';
COMMENT ON COLUMN role_room_stripboard_entries.setup_minutes IS
  'Rigge-/flyttetid før scenen. Seks korte scener på seks steder er verre enn én lang på ett.';
