-- Add manuscript scene ID link to shot planner scenes
ALTER TABLE shot_planner_scenes 
ADD COLUMN IF NOT EXISTS manuscript_scene_id TEXT;

-- Add index for manuscript lookups
CREATE INDEX IF NOT EXISTS idx_shot_planner_manuscript_scene 
ON shot_planner_scenes(manuscript_scene_id);

-- Add helpful comment
COMMENT ON COLUMN shot_planner_scenes.manuscript_scene_id IS 'Links shot planner scene to a manuscript scene for integrated workflow';
