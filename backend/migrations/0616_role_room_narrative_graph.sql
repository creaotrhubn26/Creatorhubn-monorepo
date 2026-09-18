-- 0616_role_room_narrative_graph.sql
--
-- Story Graph — narrativ design for spillstudio-vertikalen (game_studio).
-- Datamodellen speiler Arcweaves JSON-eksport 1:1 (boards, elements, jumpers,
-- branches, connections, conditions, components, attributes, assets,
-- variables, notes) slik at import fra og eksport til Arcweave-kompatible
-- verktøy/plugins (Unity/Unreal/Godot) er tapsfri.
--
-- Alt er prosjekt-skopet under casting_projects (samme tilgangsregel som
-- resten av Role Room: eier eller casting_user_roles-medlem).

-- ─── Prosjekt-innstillinger (Arcweave: project.startingElement / cover) ──────
CREATE TABLE IF NOT EXISTS narrative_settings (
  project_id VARCHAR(255) PRIMARY KEY REFERENCES casting_projects(id) ON DELETE CASCADE,
  title TEXT,
  starting_element_id TEXT,
  cover_asset_id TEXT,
  schema_version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Brett (Arcweave: boards + board folders) ────────────────────────────────
CREATE TABLE IF NOT EXISTS narrative_boards (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  custom_id TEXT,
  -- Mappe-sti («Akt 1/Kapittel 2»). Tom streng = rot.
  folder_path TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Sist brukte viewport { x, y, zoom } per brett.
  viewport JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS narrative_boards_project_idx
  ON narrative_boards (project_id, sort_order);

-- ─── Elementer (Arcweave: elements, branches, jumpers, notes) ────────────────
CREATE TABLE IF NOT EXISTS narrative_elements (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  board_id TEXT NOT NULL REFERENCES narrative_boards(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'element',
  title_html TEXT NOT NULL DEFAULT '',
  content_html TEXT NOT NULL DEFAULT '',
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  width DOUBLE PRECISION NOT NULL DEFAULT 260,
  height DOUBLE PRECISION NOT NULL DEFAULT 120,
  theme TEXT NOT NULL DEFAULT 'default',
  cover_asset_id TEXT,
  custom_id TEXT,
  -- kind='jumper': hvilket element (kan være på et annet brett) det hopper til.
  jumper_target_id TEXT,
  -- kind='branch': [{ id, script, label }] i rekkefølge; siste uten script = else.
  branch_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Optimistisk låsing: PATCH med If-Match: <version> → 409 ved avvik.
  version INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_elements_kind
    CHECK (kind IN ('element', 'branch', 'jumper', 'note'))
);

CREATE INDEX IF NOT EXISTS narrative_elements_project_board_idx
  ON narrative_elements (project_id, board_id, sort_order);

-- ─── Koblinger (Arcweave: connections; label kan inneholde arcscript) ────────
CREATE TABLE IF NOT EXISTS narrative_connections (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  board_id TEXT NOT NULL REFERENCES narrative_boards(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES narrative_elements(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES narrative_elements(id) ON DELETE CASCADE,
  -- 'default' for elementer; condition-id for utganger fra en branch.
  source_output_key TEXT NOT NULL DEFAULT 'default',
  label_html TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS narrative_connections_project_board_idx
  ON narrative_connections (project_id, board_id);
CREATE INDEX IF NOT EXISTS narrative_connections_source_idx
  ON narrative_connections (source_id);
CREATE INDEX IF NOT EXISTS narrative_connections_target_idx
  ON narrative_connections (target_id);

-- ─── Komponenter (Arcweave: components + component folders) ─────────────────
CREATE TABLE IF NOT EXISTS narrative_components (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  folder_path TEXT NOT NULL DEFAULT '',
  cover_asset_id TEXT,
  custom_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS narrative_components_project_idx
  ON narrative_components (project_id, folder_path, sort_order);

-- ─── Komponenter festet på elementer (Arcweave: element.components) ──────────
CREATE TABLE IF NOT EXISTS narrative_element_components (
  element_id TEXT NOT NULL REFERENCES narrative_elements(id) ON DELETE CASCADE,
  component_id TEXT NOT NULL REFERENCES narrative_components(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (element_id, component_id)
);

-- ─── Attributter (Arcweave: attributes på element/komponent/brett) ───────────
-- Typede attributter (bool/int/float/string) fungerer som skopede variabler
-- (Arcweave 5.11). rich_text/component_list/asset_list er rene datafelt.
CREATE TABLE IF NOT EXISTS narrative_attributes (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  owner_kind TEXT NOT NULL,
  -- Myk referanse (element/component/board-id). Ryddes av service ved sletting.
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'string',
  value JSONB NOT NULL DEFAULT 'null'::jsonb,
  custom_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_attributes_owner_kind
    CHECK (owner_kind IN ('element', 'component', 'board')),
  CONSTRAINT chk_narrative_attributes_type
    CHECK (type IN ('rich_text', 'string', 'bool', 'int', 'float', 'component_list', 'asset_list'))
);

CREATE INDEX IF NOT EXISTS narrative_attributes_owner_idx
  ON narrative_attributes (project_id, owner_kind, owner_id, sort_order);

-- ─── Globale variabler (Arcweave: variables) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS narrative_variables (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bool',
  default_value JSONB NOT NULL DEFAULT 'false'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_variables_type
    CHECK (type IN ('bool', 'int', 'float', 'string')),
  CONSTRAINT uq_narrative_variables_project_name UNIQUE (project_id, name)
);

-- ─── Ressurser (Arcweave: assets — bilde/lyd/video) ──────────────────────────
-- Fase 1: metadata + ekstern URL. Opplasting til S3 (storage_key) er Fase 3.
CREATE TABLE IF NOT EXISTS narrative_assets (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'image',
  name TEXT NOT NULL,
  storage_key TEXT,
  external_url TEXT,
  mime TEXT,
  size_bytes BIGINT,
  folder_path TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_assets_kind
    CHECK (kind IN ('image', 'audio', 'video'))
);

CREATE INDEX IF NOT EXISTS narrative_assets_project_idx
  ON narrative_assets (project_id, folder_path, name);

-- ─── Revisjoner (Arcweave: Project History — hos oss for alle planer) ────────
CREATE TABLE IF NOT EXISTS narrative_revisions (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  label TEXT,
  -- Hele grafen i eksportformat (samme form som GET /graph).
  snapshot JSONB NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS narrative_revisions_project_idx
  ON narrative_revisions (project_id, created_at DESC);

-- ─── Delbare spill-lenker (Arcweave: Play Mode-deling) — brukes fra Fase 3 ───
CREATE TABLE IF NOT EXISTS narrative_share_links (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL DEFAULT 'play_only',
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_narrative_share_links_mode
    CHECK (mode IN ('view_play', 'play_only'))
);

CREATE INDEX IF NOT EXISTS narrative_share_links_project_idx
  ON narrative_share_links (project_id, created_at DESC);
