-- Migration: Add storyboard frames and shots tables
-- Date: 2026-01-15

-- Storyboard Frames Table
CREATE TABLE IF NOT EXISTS casting_storyboard_frames (
    id VARCHAR(255) PRIMARY KEY,
    scene_id VARCHAR(255) NOT NULL REFERENCES casting_scenes(id) ON DELETE CASCADE,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    frame_number INTEGER NOT NULL,
    shot_number VARCHAR(50),
    image_url TEXT,
    sketch TEXT,
    drawing_data JSONB,
    image_source VARCHAR(50) CHECK (image_source IN ('ai', 'captured', 'drawn', 'uploaded')),
    description TEXT,
    camera_angle VARCHAR(100),
    camera_movement VARCHAR(100),
    lens VARCHAR(50),
    duration DECIMAL(10,2),
    notes TEXT,
    script_line_start INTEGER,
    script_line_end INTEGER,
    dialogue_character VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_storyboard_frames_scene ON casting_storyboard_frames(scene_id);
CREATE INDEX IF NOT EXISTS idx_storyboard_frames_project ON casting_storyboard_frames(project_id);

-- Shots Table (Shot List)
CREATE TABLE IF NOT EXISTS casting_shots (
    id VARCHAR(255) PRIMARY KEY,
    scene_id VARCHAR(255) NOT NULL REFERENCES casting_scenes(id) ON DELETE CASCADE,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    storyboard_frame_id VARCHAR(255) REFERENCES casting_storyboard_frames(id) ON DELETE SET NULL,
    shot_number VARCHAR(50) NOT NULL,
    shot_type VARCHAR(50) CHECK (shot_type IN ('wide', 'medium', 'close-up', 'extreme-close-up', 'over-shoulder', 'pov', 'aerial', 'insert', 'establishing', 'two-shot', 'master')),
    camera_angle VARCHAR(100),
    camera_movement VARCHAR(100),
    lens VARCHAR(50),
    description TEXT,
    dialogue TEXT,
    action TEXT,
    duration DECIMAL(10,2),
    equipment_needed TEXT[],
    lighting_notes TEXT,
    sound_notes TEXT,
    vfx_notes TEXT,
    status VARCHAR(50) DEFAULT 'planned' CHECK (status IN ('planned', 'setup', 'filming', 'completed', 'retake')),
    takes_count INTEGER DEFAULT 0,
    selected_take INTEGER,
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shots_scene ON casting_shots(scene_id);
CREATE INDEX IF NOT EXISTS idx_shots_project ON casting_shots(project_id);
CREATE INDEX IF NOT EXISTS idx_shots_status ON casting_shots(status);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_storyboard_frames_updated_at ON casting_storyboard_frames;
CREATE TRIGGER update_storyboard_frames_updated_at 
    BEFORE UPDATE ON casting_storyboard_frames 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shots_updated_at ON casting_shots;
CREATE TRIGGER update_shots_updated_at 
    BEFORE UPDATE ON casting_shots 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add some sample storyboard frames for TROLL
INSERT INTO casting_storyboard_frames (id, scene_id, project_id, frame_number, shot_number, description, camera_angle, camera_movement, duration, sort_order)
VALUES 
    ('sb-troll-1-1', 'troll-demo-troll-project-2026-scene-1', 'troll-project-2026', 1, '1A', 'Wide shot of Dovre mountains at night. Tunnel entrance visible with lights.', 'Wide', 'Slow push in', 5.0, 1),
    ('sb-troll-1-2', 'troll-demo-troll-project-2026-scene-1', 'troll-project-2026', 2, '1B', 'Medium shot of workers operating the boring machine.', 'Medium', 'Static', 3.0, 2),
    ('sb-troll-1-3', 'troll-demo-troll-project-2026-scene-1', 'troll-project-2026', 3, '1C', 'Close-up on Arbeider 1 as he shouts over the noise.', 'Close-up', 'Slight handheld', 2.0, 3),
    ('sb-troll-1-4', 'troll-demo-troll-project-2026-scene-1', 'troll-project-2026', 4, '1D', 'POV shot looking into the dark cavern as flashlights reveal the void.', 'POV', 'Push in', 4.0, 4),
    ('sb-troll-2-1', 'troll-demo-troll-project-2026-scene-2', 'troll-project-2026', 1, '2A', 'Wide shot inside the cave. Strange organic formations visible.', 'Wide', 'Slow tracking', 4.0, 1),
    ('sb-troll-2-2', 'troll-demo-troll-project-2026-scene-2', 'troll-project-2026', 2, '2B', 'Close-up on Arbeider 2 face, fear in his eyes.', 'Close-up', 'Static', 2.0, 2),
    ('sb-troll-2-3', 'troll-demo-troll-project-2026-scene-2', 'troll-project-2026', 3, '2C', 'Extreme wide as two giant eyes open in the darkness.', 'Extreme Wide', 'Fast zoom out', 3.0, 3),
    ('sb-troll-3-1', 'troll-demo-troll-project-2026-scene-3', 'troll-project-2026', 1, '3A', 'Interior Noras apartment. Morning light through windows.', 'Wide', 'Static establishing', 3.0, 1),
    ('sb-troll-3-2', 'troll-demo-troll-project-2026-scene-3', 'troll-project-2026', 2, '3B', 'Medium shot of Nora waking up, TV news in background.', 'Medium', 'Slow push', 4.0, 2)
ON CONFLICT (id) DO NOTHING;

-- Add sample shots
INSERT INTO casting_shots (id, scene_id, project_id, storyboard_frame_id, shot_number, shot_type, camera_angle, camera_movement, description, status, sort_order)
VALUES
    ('shot-troll-1-1', 'troll-demo-troll-project-2026-scene-1', 'troll-project-2026', 'sb-troll-1-1', '1A', 'wide', 'Low angle', 'Slow push in', 'Establishing shot of Dovre tunnel entrance', 'planned', 1),
    ('shot-troll-1-2', 'troll-demo-troll-project-2026-scene-1', 'troll-project-2026', 'sb-troll-1-2', '1B', 'medium', 'Eye level', 'Static', 'Workers at boring machine', 'planned', 2),
    ('shot-troll-1-3', 'troll-demo-troll-project-2026-scene-1', 'troll-project-2026', 'sb-troll-1-3', '1C', 'close-up', 'Eye level', 'Handheld', 'Arbeider 1 dialogue', 'planned', 3),
    ('shot-troll-1-4', 'troll-demo-troll-project-2026-scene-1', 'troll-project-2026', 'sb-troll-1-4', '1D', 'pov', 'Eye level', 'Push in', 'POV discovering the cave', 'planned', 4),
    ('shot-troll-2-1', 'troll-demo-troll-project-2026-scene-2', 'troll-project-2026', 'sb-troll-2-1', '2A', 'wide', 'Low angle', 'Tracking', 'Inside the ancient cave', 'planned', 1),
    ('shot-troll-2-2', 'troll-demo-troll-project-2026-scene-2', 'troll-project-2026', 'sb-troll-2-2', '2B', 'close-up', 'Eye level', 'Static', 'Arbeider 2 reaction', 'planned', 2),
    ('shot-troll-2-3', 'troll-demo-troll-project-2026-scene-2', 'troll-project-2026', 'sb-troll-2-3', '2C', 'wide', 'Low angle', 'Fast zoom out', 'Troll eyes opening - VFX shot', 'planned', 3),
    ('shot-troll-3-1', 'troll-demo-troll-project-2026-scene-3', 'troll-project-2026', 'sb-troll-3-1', '3A', 'establishing', 'High angle', 'Static', 'Noras apartment morning', 'planned', 1),
    ('shot-troll-3-2', 'troll-demo-troll-project-2026-scene-3', 'troll-project-2026', 'sb-troll-3-2', '3B', 'medium', 'Eye level', 'Slow push', 'Nora waking to news', 'planned', 2)
ON CONFLICT (id) DO NOTHING;

SELECT 'Migration completed successfully!' as status;
