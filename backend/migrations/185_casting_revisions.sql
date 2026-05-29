-- Migrasjon 185: casting_revisions
--
-- Snapshot/historikk-rader for manuskripter. Hver revisjon lagrer hele
-- manuskriptets content + en kort change-summary slik at Script Revisjoner
-- & Diff Viewer kan sammenligne v1 → v2 → v3 osv.

CREATE TABLE IF NOT EXISTS casting_revisions (
  id              VARCHAR(255) PRIMARY KEY,
  project_id      VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  manuscript_id   VARCHAR(255) NOT NULL REFERENCES casting_manuscripts(id) ON DELETE CASCADE,
  version         VARCHAR(32) NOT NULL,
  change_summary  TEXT,
  revision_notes  TEXT,
  content         TEXT,
  created_by      VARCHAR(255),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS casting_revisions_project_id_idx
  ON casting_revisions(project_id);

CREATE INDEX IF NOT EXISTS casting_revisions_manuscript_id_idx
  ON casting_revisions(manuscript_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS casting_revisions_manuscript_version_idx
  ON casting_revisions(manuscript_id, version);
