-- Storyboard Room uses stable scene/frame identifiers that predate UUID-only
-- entities (for example imported boards and demo projects). The suggestion
-- table is explicitly polymorphic and has no FK on these identity columns, so
-- TEXT is the correct backwards-compatible representation.

ALTER TABLE casting_ai_suggestions
  ALTER COLUMN project_id TYPE TEXT USING project_id::text,
  ALTER COLUMN source_id TYPE TEXT USING source_id::text,
  ALTER COLUMN reviewed_by TYPE TEXT USING reviewed_by::text;

COMMENT ON COLUMN casting_ai_suggestions.project_id IS
  'Role Room project identity; UUID or stable legacy/demo identifier.';
COMMENT ON COLUMN casting_ai_suggestions.source_id IS
  'Polymorphic source identity; scene/frame/role/manuscript/project IDs may be non-UUID.';
