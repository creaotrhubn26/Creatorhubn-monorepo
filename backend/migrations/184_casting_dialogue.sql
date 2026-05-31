-- Migrasjon 184: casting_dialogue
--
-- Tabell for manuskript-dialog-linjer. Hver linje knyttes til manus +
-- (valgfritt) scene + karakter. Linjenummer brukes for ordering og for
-- å koble dialog til scriptLineRange på storyboard-frames.
--
-- Dialog-fanen i ManuscriptPanel + character-ekstraksjon i Story Logic
-- leser fra denne tabellen.

CREATE TABLE IF NOT EXISTS casting_dialogue (
  id               VARCHAR(255) PRIMARY KEY,
  project_id       VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  manuscript_id    VARCHAR(255) NOT NULL REFERENCES casting_manuscripts(id) ON DELETE CASCADE,
  scene_id         VARCHAR(255) REFERENCES casting_scenes(id) ON DELETE SET NULL,
  character_name   VARCHAR(255) NOT NULL,
  dialogue_text    TEXT NOT NULL,
  dialogue_type    VARCHAR(32) NOT NULL DEFAULT 'dialogue',
  parenthetical    VARCHAR(255),
  emotion_tag      VARCHAR(64),
  line_number      INTEGER,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS casting_dialogue_project_id_idx
  ON casting_dialogue(project_id);

CREATE INDEX IF NOT EXISTS casting_dialogue_manuscript_id_idx
  ON casting_dialogue(manuscript_id);

CREATE INDEX IF NOT EXISTS casting_dialogue_scene_id_idx
  ON casting_dialogue(scene_id)
  WHERE scene_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS casting_dialogue_manuscript_line_idx
  ON casting_dialogue(manuscript_id, line_number);
