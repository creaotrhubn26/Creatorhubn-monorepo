-- 0076_casting_storyboards.sql
-- Persistens for storyboard-skisser (PencilCanvas-strokes + raster).
-- Tidligere lagret kun i React-state og forsvant ved page reload.

CREATE TABLE IF NOT EXISTS casting_storyboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  scene_id VARCHAR(255),                       -- optional FK til casting_scenes(id)
  frame_id VARCHAR(255),                       -- valgfri ekstern ID (f.eks. drawingFrame.id)
  title TEXT,
  -- Strokes-array som JSONB: [{x,y,pressure,brushSize,color,timestamp}, ...]
  strokes JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Rasterized PNG/dataURL for thumbnails
  image_data TEXT,
  width INTEGER,
  height INTEGER,
  workflow_level VARCHAR(32),                  -- 'idea' | 'rough' | 'detailed' | 'final'
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS casting_storyboards_project_idx
  ON casting_storyboards(project_id);
CREATE INDEX IF NOT EXISTS casting_storyboards_scene_idx
  ON casting_storyboards(scene_id) WHERE scene_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS casting_storyboards_frame_idx
  ON casting_storyboards(project_id, frame_id) WHERE frame_id IS NOT NULL;
