-- 0599_video_qc_queue_guards.sql
-- Prevent duplicate full-file QC scans for the same video version. The durable
-- execution itself uses background_jobs (migration 0400); the QC row remains
-- the user-facing status record.

WITH duplicate_running AS (
  SELECT id,ROW_NUMBER() OVER (PARTITION BY version_id ORDER BY created_at DESC,id) row_number
    FROM project_video_qc_results
   WHERE status='running'
)
UPDATE project_video_qc_results qc
   SET status='failed',
       summary=jsonb_build_object('phase','superseded','findingCount',1),
       findings='[{"severity":"error","code":"qc_superseded","message":"En nyere QC-kjøring tok over."}]'::jsonb,
       completed_at=NOW()
  FROM duplicate_running duplicate
 WHERE qc.id=duplicate.id AND duplicate.row_number>1;

CREATE UNIQUE INDEX IF NOT EXISTS project_video_qc_one_running_per_version_idx
  ON project_video_qc_results(version_id)
  WHERE status = 'running';
