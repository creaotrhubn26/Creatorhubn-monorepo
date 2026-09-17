-- 0611_narrative_production_os.sql
--
-- Story Graph Fase 7 — produksjons-OS rundt Story Graph, datamodell for å
-- bygge et spill fra et manus: scenekort v2 (Før/Handling/Kontroll/Etter/
-- Lyd/Endring/Bro + kildemerking + epoke + kunnskapsfelt), leveransegater
-- med bevis, replikker som data, episoder/beats, åpne spørsmål og sjekk-
-- lister, kilderegister med SHA-256, komponent-type/profil (karakterer,
-- lokasjoner, fraksjoner) og milepæler for produksjonsplanen.
--
-- Avledet av studioets egne dokumenter (OPENING-HYBRID-v2, SCENE-PLAN-v3,
-- Storyline-v2, OPENING-DIALOGUE-v2, AGENTS.md). Samme konvensjoner som
-- 0605/0610. Team (0612) og gjeste-reviewere (0613) er egne migrasjoner.

-- ─── Scenekort v2 ───────────────────────────────────────────────────────────
ALTER TABLE narrative_scenes
  ADD COLUMN IF NOT EXISTS before_state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS control TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS after_state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS audio TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS change_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bridge TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS time_note TEXT NOT NULL DEFAULT '',
  -- Seks kunnskapsfelt fra SCENE-PLAN §E: actualPast, recollection,
  -- ownerPerspective, othersObserve, audienceKnows, saidAloud.
  ADD COLUMN IF NOT EXISTS knowledge JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS era TEXT NOT NULL DEFAULT 'other',
  -- Myk referanse til narrative_episodes (E01–E12).
  ADD COLUMN IF NOT EXISTS episode_id TEXT,
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  -- [{ tag: 'W'|'K'|'U'|'A'|'E'|'T', ref: 'W01', field?: 'action', note?: '' }]
  ADD COLUMN IF NOT EXISTS source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Dokumentenes arbeids-ID (P01, G03A, H01) — `code` er den korte koden.
  ADD COLUMN IF NOT EXISTS working_id TEXT;

ALTER TABLE narrative_scenes DROP CONSTRAINT IF EXISTS chk_narrative_scenes_era;
ALTER TABLE narrative_scenes
  ADD CONSTRAINT chk_narrative_scenes_era
  CHECK (era IN ('pre', '1797', '1802', '1817', 'other'));

-- Scenekoder som «G03A» (SCENE-PLAN-v3) trenger valgfri bokstav-suffiks.
ALTER TABLE narrative_scenes DROP CONSTRAINT IF EXISTS chk_narrative_scenes_code;
ALTER TABLE narrative_scenes
  ADD CONSTRAINT chk_narrative_scenes_code
  CHECK (code ~ '^[A-Za-z]{1,3}[0-9]{1,4}[A-Za-z]?$');

CREATE INDEX IF NOT EXISTS narrative_scenes_episode_idx
  ON narrative_scenes (project_id, episode_id)
  WHERE episode_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS narrative_scenes_plan_idx
  ON narrative_scenes (project_id, start_at, due_at);

-- Scene ⇄ komponent (karakter/lokasjon) via samme lenketabell.
ALTER TABLE narrative_scene_links DROP CONSTRAINT IF EXISTS chk_narrative_scene_links_owner_kind;
ALTER TABLE narrative_scene_links
  ADD CONSTRAINT chk_narrative_scene_links_owner_kind
  CHECK (owner_kind IN ('element', 'board', 'component'));

-- ─── Leveransegater per scene (reell status + bevis) ────────────────────────
CREATE TABLE IF NOT EXISTS narrative_scene_gates (
  scene_id TEXT NOT NULL REFERENCES narrative_scenes(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  gate_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  evidence TEXT NOT NULL DEFAULT '',
  -- [ 'build/Prologue-P01-Final.xcresult', '../Verification/P01-Staging.md' ]
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  checked_by TEXT,
  checked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scene_id, gate_key),
  CONSTRAINT chk_narrative_scene_gates_key
    CHECK (gate_key IN ('script_coverage', 'greybox', 'characters_animation', 'playthrough', 'picture', 'audio')),
  CONSTRAINT chk_narrative_scene_gates_status
    CHECK (status IN ('not_started', 'in_progress', 'passed', 'failed')),
  -- Forebygg: «bestått» krever bevis («Ingen gate er bestått fordi dokumentet finnes»).
  CONSTRAINT chk_narrative_scene_gates_evidence
    CHECK (status <> 'passed' OR length(evidence) > 0)
);

CREATE INDEX IF NOT EXISTS narrative_scene_gates_project_idx
  ON narrative_scene_gates (project_id, gate_key, status);

-- ─── Replikker som data (W01.01 · taler · type · EN · NB · opptak) ─────────
CREATE TABLE IF NOT EXISTS narrative_scene_lines (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES narrative_scenes(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  cue_id TEXT NOT NULL,
  -- Myk referanse til narrative_components (kind='character').
  speaker_component_id TEXT,
  speaker_label TEXT NOT NULL DEFAULT '',
  -- «bare i Elises perspektiv»
  perspective TEXT NOT NULL DEFAULT '',
  text_en TEXT NOT NULL DEFAULT '',
  text_nb TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'T',
  recording_status TEXT NOT NULL DEFAULT 'none',
  note TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_scene_lines_source_type
    CHECK (source_type IN ('E', 'T', 'E+T', 'U', 'A')),
  CONSTRAINT chk_narrative_scene_lines_recording
    CHECK (recording_status IN ('none', 'needs_take', 'recorded', 'approved')),
  CONSTRAINT narrative_scene_lines_scene_cue_key UNIQUE (scene_id, cue_id)
);

CREATE INDEX IF NOT EXISTS narrative_scene_lines_scene_idx
  ON narrative_scene_lines (scene_id, sort_order);
CREATE INDEX IF NOT EXISTS narrative_scene_lines_speaker_idx
  ON narrative_scene_lines (project_id, speaker_component_id)
  WHERE speaker_component_id IS NOT NULL;

-- ─── Episoder / beats (E01–E12) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS narrative_episodes (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  players_learn TEXT NOT NULL DEFAULT '',
  source_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_episodes_status CHECK (status IN ('draft', 'locked')),
  CONSTRAINT narrative_episodes_project_code_key UNIQUE (project_id, code)
);

CREATE INDEX IF NOT EXISTS narrative_episodes_project_idx
  ON narrative_episodes (project_id, sort_order);

-- ─── Åpne spørsmål og sjekklister ([x]/[ ]) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS narrative_open_questions (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  -- Idempotens-nøkkel («Q07», «C03»).
  code TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'question',
  question TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  decision TEXT NOT NULL DEFAULT '',
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_open_questions_kind CHECK (kind IN ('question', 'check')),
  CONSTRAINT chk_narrative_open_questions_status CHECK (status IN ('open', 'done', 'dropped')),
  CONSTRAINT narrative_open_questions_project_code_key UNIQUE (project_id, code)
);

CREATE INDEX IF NOT EXISTS narrative_open_questions_project_idx
  ON narrative_open_questions (project_id, status, sort_order);

-- ─── Kilderegister (manus, PDF, arbeidsdokumenter) med SHA-256 ─────────────
CREATE TABLE IF NOT EXISTS narrative_sources (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  -- Kort kode som `source_refs.tag/ref` slår opp mot («W», «K», «EN-MASTER»).
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other',
  sha256 CHAR(64),
  path_hint TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_sources_kind CHECK (kind IN ('docx', 'pdf', 'md', 'txt', 'other')),
  CONSTRAINT chk_narrative_sources_sha256 CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT narrative_sources_project_code_key UNIQUE (project_id, code)
);

CREATE INDEX IF NOT EXISTS narrative_sources_project_idx
  ON narrative_sources (project_id, sort_order);

-- ─── Komponenter: type + profil (karakter / lokasjon / gjenstand / fraksjon) ─
ALTER TABLE narrative_components
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'other',
  -- Typet per kind i TS: karakter {drive, changeAction, authorTruth (intern),
  -- observable, ages, voiceCast, memoryTrack[], powers}, lokasjon {eras[],
  -- continuity, geometryStatus, props[]}.
  ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE narrative_components DROP CONSTRAINT IF EXISTS chk_narrative_components_kind;
ALTER TABLE narrative_components
  ADD CONSTRAINT chk_narrative_components_kind
  CHECK (kind IN ('character', 'location', 'item', 'faction', 'other'));

CREATE INDEX IF NOT EXISTS narrative_components_kind_idx
  ON narrative_components (project_id, kind, sort_order);

-- ─── Milepæler (produksjonsplan) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS narrative_milestones (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  lane TEXT NOT NULL DEFAULT 'other',
  start_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'planned',
  owner_user_id TEXT,
  description TEXT NOT NULL DEFAULT '',
  -- Akseptansekriterier og faktisk bevis (tekniske kontrakter bærer tester).
  acceptance TEXT NOT NULL DEFAULT '',
  evidence TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_milestones_lane
    CHECK (lane IN ('story', 'greybox', 'characters', 'playtest', 'picture_audio', 'engineering', 'other')),
  CONSTRAINT chk_narrative_milestones_status
    CHECK (status IN ('planned', 'in_progress', 'done', 'blocked'))
);

CREATE INDEX IF NOT EXISTS narrative_milestones_project_idx
  ON narrative_milestones (project_id, lane, start_at, due_at);

CREATE TABLE IF NOT EXISTS narrative_milestone_scenes (
  milestone_id TEXT NOT NULL REFERENCES narrative_milestones(id) ON DELETE CASCADE,
  scene_id TEXT NOT NULL REFERENCES narrative_scenes(id) ON DELETE CASCADE,
  PRIMARY KEY (milestone_id, scene_id)
);

CREATE INDEX IF NOT EXISTS narrative_milestone_scenes_scene_idx
  ON narrative_milestone_scenes (scene_id);

-- ─── Plattformmål: hva spillet bygges for, hva det krever, hvordan det ser ut ─
-- Én rad per målplattform (iPad Pro M1 minste mål, iPhone senere …). Budsjetter
-- og krav er *mål med status*, ikke bevis: «Startbudsjettene er fortsatt mål,
-- ikke godkjente resultater» (CINEMATIC-M1-QUALITY-v1).
CREATE TABLE IF NOT EXISTS narrative_platform_targets (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'other',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  engine TEXT NOT NULL DEFAULT '',
  os_min TEXT NOT NULL DEFAULT '',
  device_min TEXT NOT NULL DEFAULT '',
  input_model TEXT NOT NULL DEFAULT '',
  -- { fps, frameMs, gpuMs, cpuMs, internalResolutionPct, memoryGb, warmTestMinutes, filmFormat }
  budgets JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- [{ code, text, status: 'unverified'|'verified'|'failed', evidence, source }]
  requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- { lookAndFeel, lighting, materials, camera, fog, ui, audio, referenceAssetIds[] }
  visual_direction JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_platform_targets_platform
    CHECK (platform IN ('ipad', 'iphone', 'mac', 'pc', 'console', 'web', 'other'))
);

CREATE INDEX IF NOT EXISTS narrative_platform_targets_project_idx
  ON narrative_platform_targets (project_id, sort_order);
-- Kun ett primærmål per prosjekt.
CREATE UNIQUE INDEX IF NOT EXISTS narrative_platform_targets_primary_idx
  ON narrative_platform_targets (project_id)
  WHERE is_primary;

-- ─── Plan-gating: produksjonsplan Pro/Studio; team og gjester Studio ───────
UPDATE game_plan
   SET features = (
         SELECT jsonb_agg(DISTINCT v) FROM (
           SELECT jsonb_array_elements_text(features) AS v
           UNION SELECT 'production_plan'
         ) merged_features
       ),
       updated_at = now()
 WHERE slug IN ('pro', 'studio')
   AND NOT (features @> '["production_plan"]'::jsonb);

UPDATE game_plan
   SET features = (
         SELECT jsonb_agg(DISTINCT v) FROM (
           SELECT jsonb_array_elements_text(features) AS v
           UNION SELECT 'team_seats'
           UNION SELECT 'guest_reviewers'
         ) merged_features
       ),
       updated_at = now()
 WHERE slug = 'studio'
   AND NOT (features @> '["team_seats", "guest_reviewers"]'::jsonb);
