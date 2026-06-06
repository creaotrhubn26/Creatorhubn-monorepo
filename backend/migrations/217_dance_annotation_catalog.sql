-- 217_dance_annotation_catalog.sql
-- Prosjekt-spesifikke annotering-kategorier + labels for DanceAnnotate.
--
-- Eksisterende dance_video_annotation.category (TEXT) holdes — den peker
-- nå til dance_annotation_category.id ELLER til en av de 5 'hardkodede'
-- defaults (steps/arms/body/jumps/turns) som ikke skrives til DB.
--
-- Defaults seedes IKKE i denne migrasjonen — backend-service auto-seeder
-- når listCategories returnerer tom liste for (owner, project=NULL). Det
-- holder defaults distinct fra prosjekt-spesifikke uten ekstra spørringer
-- under last.

CREATE TABLE IF NOT EXISTS dance_annotation_category (
  id              TEXT PRIMARY KEY,
  owner_user_id   TEXT NOT NULL,
  -- NULL = global/bruker-bibliotek; satt = prosjekt-spesifikk
  project_id      TEXT,
  name            VARCHAR(80) NOT NULL,
  -- Hex-farge, '#rrggbb' eller '#rgb'. UI validerer.
  color           VARCHAR(20) NOT NULL,
  -- 1-tegns shortcut for keyboard-binding (typisk '1'-'9'). Null = ingen
  -- snarvei. Server håndhever ikke uniqueness; UI varsler ved konflikt.
  shortcut        VARCHAR(8),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  -- True = en av 5 hardkodede defaults (steps/arms/body/jumps/turns).
  -- Klient kan IKKE slette default; kan endre navn/farge.
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dance_annotation_category_owner_project_idx
  ON dance_annotation_category (owner_user_id, project_id, sort_order);

CREATE TABLE IF NOT EXISTS dance_annotation_label (
  id              TEXT PRIMARY KEY,
  owner_user_id   TEXT NOT NULL,
  project_id      TEXT,
  -- NULL = label kan brukes på tvers av kategorier; satt = bundet til
  -- spesifikk kategori (vises kun når category=denne er aktiv).
  category_id     TEXT,
  name            VARCHAR(120) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dance_annotation_label_owner_project_idx
  ON dance_annotation_label (owner_user_id, project_id, category_id, sort_order);
