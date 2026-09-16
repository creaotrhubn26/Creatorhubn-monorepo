-- 0610_narrative_scenes_and_reviews.sql
--
-- Story Graph Fase 6 — «Scener & gameplay» + «Review & Godkjenning» for
-- spillstudio-vertikalen (game_studio). Scener er produksjonsenheter rundt
-- Story Graph (én scene = kode «S12», tittel, lokasjon, utfordring, spill-
-- mekanikk, miljø, status, ansvarlig, frist) med storyboard-rammer, oppgaver,
-- lenker til Story Graph-elementer/-brett og review-runder med immutabelt
-- snapshot (mønster fra 0592_storyboard_review_rounds.sql).
--
-- Egne narrative_scene*-tabeller (ikke casting_scenes / role_room_phase_
-- timeline_items): film-scenene er blob-først og mangler status/ansvarlig,
-- og timeline-ACL-en avviser spillstudio-eiere. Samme konvensjoner som 0605.

-- ─── Scener ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS narrative_scenes (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  -- Kort scenekode («S12», «B3», «INT7»): 1–3 bokstaver + 1–4 sifre, unik per prosjekt.
  code TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  challenge TEXT NOT NULL DEFAULT '',
  gameplay_mechanic TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'idea',
  assignee_user_id TEXT,
  due_at TIMESTAMPTZ,
  -- Myk referanse til narrative_assets (nulles av deleteAsset).
  hero_asset_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_scenes_code
    CHECK (code ~ '^[A-Za-z]{1,3}[0-9]{1,4}$'),
  CONSTRAINT chk_narrative_scenes_status
    CHECK (status IN ('idea', 'in_progress', 'in_review', 'changes_requested', 'approved', 'implemented')),
  CONSTRAINT narrative_scenes_project_code_key UNIQUE (project_id, code)
);

CREATE INDEX IF NOT EXISTS narrative_scenes_project_idx
  ON narrative_scenes (project_id, sort_order, code);
CREATE INDEX IF NOT EXISTS narrative_scenes_assignee_idx
  ON narrative_scenes (project_id, assignee_user_id)
  WHERE assignee_user_id IS NOT NULL;

-- ─── Lenker scene ⇄ Story Graph (element eller brett) ───────────────────────
CREATE TABLE IF NOT EXISTS narrative_scene_links (
  scene_id TEXT NOT NULL REFERENCES narrative_scenes(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  owner_kind TEXT NOT NULL,
  -- Myk referanse (elementer/brett slettes → deleteElement/deleteBoard rydder).
  owner_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_scene_links_owner_kind
    CHECK (owner_kind IN ('element', 'board')),
  PRIMARY KEY (scene_id, owner_kind, owner_id)
);

-- Reverse-oppslag: «hvilke scener peker på dette elementet?»
CREATE INDEX IF NOT EXISTS narrative_scene_links_owner_idx
  ON narrative_scene_links (project_id, owner_kind, owner_id);

-- ─── Storyboard-rammer per scene ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS narrative_scene_frames (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES narrative_scenes(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  -- Enten et prosjekt-asset (myk ref) eller en ekstern URL — aldri begge/ingen.
  asset_id TEXT,
  external_url TEXT,
  caption TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_scene_frames_source
    CHECK ((asset_id IS NOT NULL) <> (external_url IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS narrative_scene_frames_scene_idx
  ON narrative_scene_frames (scene_id, sort_order);
CREATE INDEX IF NOT EXISTS narrative_scene_frames_asset_idx
  ON narrative_scene_frames (project_id, asset_id)
  WHERE asset_id IS NOT NULL;

-- ─── Oppgaver per scene ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS narrative_scene_tasks (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES narrative_scenes(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  assignee_user_id TEXT,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_scene_tasks_status
    CHECK (status IN ('todo', 'doing', 'done'))
);

CREATE INDEX IF NOT EXISTS narrative_scene_tasks_scene_idx
  ON narrative_scene_tasks (scene_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS narrative_scene_tasks_project_status_idx
  ON narrative_scene_tasks (project_id, status);

-- ─── Review-runder (immutabelt snapshot + hash, én åpen runde per scene) ────
CREATE TABLE IF NOT EXISTS narrative_scene_reviews (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES narrative_scenes(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  round INTEGER NOT NULL CHECK (round > 0),
  status TEXT NOT NULL DEFAULT 'in_review',
  requested_by TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_note TEXT,
  decided_by_user_id TEXT,
  decided_by_label TEXT,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  -- Server-autorert snapshot av scenen (felter, rammer, lenkede element-
  -- titler) på forespørselstidspunktet; beslutning krever samme hash.
  snapshot JSONB NOT NULL,
  snapshot_hash CHAR(64) NOT NULL CHECK (snapshot_hash ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_scene_reviews_status
    CHECK (status IN ('in_review', 'changes_requested', 'approved', 'superseded')),
  CONSTRAINT narrative_scene_reviews_scene_round_key UNIQUE (scene_id, round)
);

CREATE INDEX IF NOT EXISTS narrative_scene_reviews_scene_idx
  ON narrative_scene_reviews (scene_id, round DESC);
CREATE INDEX IF NOT EXISTS narrative_scene_reviews_project_status_idx
  ON narrative_scene_reviews (project_id, status, requested_at DESC);
-- Kun én åpen runde per scene (forebygger dobbel forespørsel også ved race).
CREATE UNIQUE INDEX IF NOT EXISTS narrative_scene_reviews_one_open_idx
  ON narrative_scene_reviews (scene_id)
  WHERE status = 'in_review';

CREATE OR REPLACE FUNCTION protect_narrative_scene_review_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.scene_id IS DISTINCT FROM OLD.scene_id
     OR NEW.round IS DISTINCT FROM OLD.round
     OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
     OR NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash
     OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'narrative scene review snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_narrative_scene_review_snapshot_update ON narrative_scene_reviews;
CREATE TRIGGER protect_narrative_scene_review_snapshot_update
  BEFORE UPDATE ON narrative_scene_reviews
  FOR EACH ROW EXECUTE FUNCTION protect_narrative_scene_review_snapshot();

-- ─── Kommentarer: nye ankertyper i den delte editor-comments-tabellen ───────
-- Gjeldende CHECK er fra 0574 (17 verdier). Gjenopprettes med de samme + to
-- narrative-ankere (scene og storyboard-ramme). Ruten validerer at anker-
-- referansen tilhører prosjektet (narrativeAnchorBelongsToProject).
ALTER TABLE role_room_editor_comments
  DROP CONSTRAINT IF EXISTS role_room_editor_comments_anchor_type_check;

ALTER TABLE role_room_editor_comments
  ADD CONSTRAINT role_room_editor_comments_anchor_type_check
  CHECK (anchor_type IN (
    'timestamp', 'pick', 'cut', 'lower_third',
    'caption', 'broll', 'music', 'general',
    'content_post', 'marketing_plan_post', 'feed_plan_post',
    'gallery_image', 'storyboard_frame',
    'manuscript', 'manuscript_scene', 'screenplay_line', 'beat',
    'narrative_scene', 'narrative_scene_frame'
  ));

COMMENT ON CONSTRAINT role_room_editor_comments_anchor_type_check
  ON role_room_editor_comments IS
  'Shared editor anchors, including manuscript, screenplay text and Story Graph scenes.';

-- ─── Plan-gating: review-runder er Pro/Studio (scener og oppgaver er ugatet) ─
UPDATE game_plan
   SET features = (
         SELECT jsonb_agg(DISTINCT v) FROM (
           SELECT jsonb_array_elements_text(features) AS v
           UNION SELECT 'scene_review'
         ) merged_features
       ),
       updated_at = now()
 WHERE slug IN ('pro', 'studio')
   AND NOT (features @> '["scene_review"]'::jsonb);
