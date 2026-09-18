CREATE TABLE IF NOT EXISTS demo_studio_mockup_projects (
  id                 TEXT NOT NULL,
  created_by         TEXT NOT NULL,
  name               TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft',
  template_id        TEXT,
  project_updated_at BIGINT NOT NULL,
  payload            JSONB NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_by),
  CONSTRAINT demo_studio_mockup_projects_status_check
    CHECK (status IN ('draft', 'ready', 'exported', 'archived')),
  CONSTRAINT demo_studio_mockup_projects_updated_at_check
    CHECK (project_updated_at > 0)
);

CREATE INDEX IF NOT EXISTS demo_studio_mockup_projects_owner_updated_idx
  ON demo_studio_mockup_projects (created_by, project_updated_at DESC);
