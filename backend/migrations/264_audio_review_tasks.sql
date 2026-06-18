-- 264_audio_review_tasks.sql
--
-- Tasks for Audio Showcase feedback-studioet (spec: «Tasks i stedet for AI»).
-- Lar produsent/band gjøre om kommentarer til konkrete, sporbare oppgaver
-- (f.eks. «fiks bass i refreng»), med status + valgfri kobling til kommentar.

CREATE TABLE IF NOT EXISTS audio_review_tasks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES audio_review_projects(id) ON DELETE CASCADE,
  version_id    UUID,
  comment_id    UUID,
  title         TEXT        NOT NULL,
  -- todo | in_progress | done
  status        TEXT        NOT NULL DEFAULT 'todo',
  assignee      TEXT,
  created_by    TEXT,
  order_index   INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audio_tasks_project ON audio_review_tasks (project_id);
