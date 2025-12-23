-- Story Arc Studio editor state storage
CREATE TABLE IF NOT EXISTS story_arc_editor_states (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  story_arc_id varchar NOT NULL REFERENCES story_arc_projects(id) ON DELETE CASCADE,
  user_id varchar,
  editor_state jsonb NOT NULL,
  version integer DEFAULT 1,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Ensure one state per story arc for simple upsert
CREATE UNIQUE INDEX IF NOT EXISTS uq_story_arc_editor_states_story_arc_id ON story_arc_editor_states(story_arc_id);

CREATE INDEX IF NOT EXISTS idx_story_arc_editor_states_updated_at ON story_arc_editor_states(updated_at);