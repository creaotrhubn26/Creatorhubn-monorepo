-- Project-scoped, conflict-safe operational lane for Production Design and
-- the Art Department. Scene, prop, storyboard and production-day identity
-- remains in the existing canonical tables; this row stores only the
-- department's decisions, readiness and handoff state.

CREATE TABLE IF NOT EXISTS role_room_art_department_operations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  VARCHAR(255) NOT NULL
                REFERENCES casting_projects(id) ON DELETE CASCADE,
  operations  JSONB NOT NULL DEFAULT '{}'::jsonb,
  version     INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_by  VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT role_room_art_department_operations_project_unique
    UNIQUE (project_id),
  CONSTRAINT role_room_art_department_operations_payload_object
    CHECK (jsonb_typeof(operations) = 'object')
);

CREATE INDEX IF NOT EXISTS role_room_art_department_operations_updated_idx
  ON role_room_art_department_operations (project_id, updated_at DESC);

COMMENT ON TABLE role_room_art_department_operations IS
  'Versioned project-wide Production Design lane; canonical scene, prop, storyboard and production-day data stays in its owning tables.';
