-- 0585_audio_review_task_comment_uniqueness.sql
-- Recall Mode has one actionable recall per source comment. Preserve any
-- historical duplicate tasks, but unlink the older duplicates before adding
-- the database-level concurrency guard.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, comment_id
      ORDER BY
        CASE status WHEN 'in_progress' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END,
        updated_at DESC,
        created_at DESC,
        id
    ) AS duplicate_rank
  FROM audio_review_tasks
  WHERE comment_id IS NOT NULL
)
UPDATE audio_review_tasks AS task
SET comment_id = NULL,
    updated_at = NOW()
FROM ranked
WHERE task.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_audio_review_tasks_project_comment
  ON audio_review_tasks (project_id, comment_id)
  WHERE comment_id IS NOT NULL;
