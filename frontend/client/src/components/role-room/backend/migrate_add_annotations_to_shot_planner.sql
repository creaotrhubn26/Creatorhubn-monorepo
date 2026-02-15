-- Add annotations support to shot planner scenes
ALTER TABLE shot_planner_scenes 
ADD COLUMN IF NOT EXISTS annotations JSONB DEFAULT '[]'::jsonb;

-- Create index for annotation queries
CREATE INDEX IF NOT EXISTS idx_shot_planner_scenes_has_annotations 
ON shot_planner_scenes 
USING gin(annotations);

-- Update modified_at timestamp for existing records
UPDATE shot_planner_scenes 
SET updated_at = NOW() 
WHERE annotations IS NULL OR annotations = '[]'::jsonb;
