-- Editable review feedback -> accepted design changes with immutable audit history.

CREATE TABLE IF NOT EXISTS mockup_studio_change_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  version_id BIGINT NOT NULL,
  source_comment_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  source_revision INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','rejected','applied')),
  operations JSONB NOT NULL DEFAULT '[]'::jsonb,
  generator TEXT NOT NULL DEFAULT 'local-rules-v1',
  confidence REAL NOT NULL DEFAULT 0
    CHECK (confidence >= 0 AND confidence <= 1),
  created_by_user_id TEXT NOT NULL,
  reviewed_by_user_id TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  applied_version_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(operations) = 'array'),
  CHECK (cardinality(source_comment_ids) BETWEEN 1 AND 20)
);

-- Some production Mockup tables predate the dedicated migration role and are
-- owned by the runtime role. Keep this migration deployable under that split
-- ownership, while adding referential constraints wherever REFERENCES is
-- available. The API also validates all three relationships before insert or
-- apply, and project deletion removes change sets transactionally.
DO $$ BEGIN
  ALTER TABLE mockup_studio_change_sets
    ADD CONSTRAINT mockup_studio_change_sets_project_fk
    FOREIGN KEY (project_id, created_by)
    REFERENCES mockup_studio_project_state (project_id, created_by) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping mockup_studio_change_sets project FK: insufficient REFERENCES privilege';
END $$;

DO $$ BEGIN
  ALTER TABLE mockup_studio_change_sets
    ADD CONSTRAINT mockup_studio_change_sets_version_fk
    FOREIGN KEY (version_id) REFERENCES mockup_studio_versions(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping mockup_studio_change_sets version FK: insufficient REFERENCES privilege';
END $$;

DO $$ BEGIN
  ALTER TABLE mockup_studio_change_sets
    ADD CONSTRAINT mockup_studio_change_sets_applied_version_fk
    FOREIGN KEY (applied_version_id) REFERENCES mockup_studio_versions(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping mockup_studio_change_sets applied-version FK: insufficient REFERENCES privilege';
END $$;

CREATE INDEX IF NOT EXISTS mockup_studio_change_sets_version_idx
  ON mockup_studio_change_sets (version_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mockup_studio_change_sets_project_status_idx
  ON mockup_studio_change_sets (created_by, project_id, status, updated_at DESC);
