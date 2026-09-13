-- Add Avid Media Composer as a first-class NLE marker-sync transport.
-- The marker rows and identities stay in the existing canonical sync table;
-- only the editor discriminator changes.

BEGIN;

ALTER TABLE project_video_marker_sync
  DROP CONSTRAINT IF EXISTS project_video_marker_sync_editor_check_v2;

ALTER TABLE project_video_marker_sync
  ADD CONSTRAINT project_video_marker_sync_editor_check_v2
  CHECK (editor IN ('resolve', 'premiere', 'final_cut', 'avid', 'generic'))
  NOT VALID;

ALTER TABLE project_video_marker_sync
  VALIDATE CONSTRAINT project_video_marker_sync_editor_check_v2;

ALTER TABLE project_video_marker_sync
  DROP CONSTRAINT IF EXISTS project_video_marker_sync_editor_check;

ALTER TABLE project_video_marker_sync
  RENAME CONSTRAINT project_video_marker_sync_editor_check_v2
  TO project_video_marker_sync_editor_check;

COMMIT;
