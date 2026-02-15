-- Shot Planner 2D Scenes Table
-- Stores 2D overhead scenes with cameras, actors, props, and shots

CREATE TABLE IF NOT EXISTS shot_planner_scenes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    pixels_per_meter REAL NOT NULL DEFAULT 10,
    show_grid BOOLEAN DEFAULT TRUE,
    grid_size INTEGER DEFAULT 50,
    cameras JSONB DEFAULT '[]'::jsonb,
    actors JSONB DEFAULT '[]'::jsonb,
    props JSONB DEFAULT '[]'::jsonb,
    shots JSONB DEFAULT '[]'::jsonb,
    active_shot_id TEXT,
    scene_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shot_planner_scenes_updated ON shot_planner_scenes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_shot_planner_scenes_name ON shot_planner_scenes(name);

-- Add helpful comment
COMMENT ON TABLE shot_planner_scenes IS 'Stores 2D overhead shot planner scenes with camera positions, actors, props, and shot configurations';
