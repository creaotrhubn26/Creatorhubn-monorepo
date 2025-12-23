ALTER TABLE story_arc_projects ADD COLUMN IF NOT EXISTS external_project_id varchar;
-- Ensure uniqueness per user+project
CREATE UNIQUE INDEX IF NOT EXISTS uq_story_arc_projects_user_external_project ON story_arc_projects(user_id, external_project_id);
