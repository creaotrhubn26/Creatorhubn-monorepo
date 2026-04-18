-- Phase 2B Lag D: link Capture sessions to UniversalDashboard projects.
-- Nullable so existing sessions don't break and "simple photo session" can
-- still create a session without a pre-existing project (the iPad
-- auto-creates a minimal project right after, then PATCHes the session).
--
-- Note: `projects.id` is a varchar (storing UUIDs as text) in the legacy
-- schema, so we mirror that type here. No FK constraint — the projects
-- table is varchar-keyed and adding a varchar FK creates noise without
-- value (the photographer's local SQLite already enforces ownership and
-- the JOIN query in capture-routes filters by ownerUserId).

ALTER TABLE capture_sessions
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS capture_sessions_project_idx
  ON capture_sessions(project_id);
