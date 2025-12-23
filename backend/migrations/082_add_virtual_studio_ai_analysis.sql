-- Migration: Add Virtual Studio AI Analysis Results Tables
-- Purpose: Persist AI analysis results (scene, pose, composition, lighting) for Virtual Studio

-- Scene Analysis Results
CREATE TABLE IF NOT EXISTS virtual_studio_scene_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- User ID (no FK constraint to avoid dependency issues)
    project_id UUID,
    scene_id UUID,
    image_url TEXT,
    image_hash VARCHAR(64), -- SHA-256 hash for deduplication
    analysis_type VARCHAR(50) NOT NULL, -- 'composition', 'lighting', 'background', 'full'
    objects JSONB, -- Detected objects with bboxes, centers, confidence
    composition_score JSONB, -- {overall, rule_of_thirds, symmetry, balance, etc.}
    lighting_metrics JSONB, -- {brightness, contrast, quality, catchlights, shadows}
    background_analysis JSONB, -- {distracting_elements, quality, suggestions}
    suggestions JSONB, -- Array of suggestions
    model_used VARCHAR(50), -- 'sam2-small', 'mediapipe', etc.
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pose Detection Results
CREATE TABLE IF NOT EXISTS virtual_studio_pose_detection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- User ID (no FK constraint to avoid dependency issues)
    project_id UUID,
    scene_id UUID,
    image_url TEXT,
    image_hash VARCHAR(64),
    landmarks JSONB NOT NULL, -- Array of pose landmarks {name, x, y, z, visibility}
    analysis JSONB, -- {posture, stance, symmetry, angles}
    ideal_pose_comparison JSONB, -- Comparison with ideal poses
    model_used VARCHAR(50) DEFAULT 'mediapipe',
    confidence DECIMAL(5,2),
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Composition Analysis History
CREATE TABLE IF NOT EXISTS virtual_studio_composition_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- User ID (no FK constraint to avoid dependency issues)
    project_id UUID,
    scene_id UUID,
    image_url TEXT,
    image_hash VARCHAR(64),
    score JSONB NOT NULL, -- {overall, rule_of_thirds, symmetry, balance, etc.}
    objects JSONB, -- Detected objects
    suggestions JSONB, -- Array of suggestions
    applied_suggestions JSONB, -- Which suggestions were applied
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lighting Analysis History
CREATE TABLE IF NOT EXISTS virtual_studio_lighting_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- User ID (no FK constraint to avoid dependency issues)
    project_id UUID,
    scene_id UUID,
    image_url TEXT,
    image_hash VARCHAR(64),
    metrics JSONB NOT NULL, -- {overall, catchlight, shadow_quality, exposure_balance, contrast}
    catchlights JSONB, -- Array of catchlight detections
    shadow_areas JSONB, -- Array of shadow area analyses
    suggestions JSONB, -- Array of suggestions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scene Optimization History
CREATE TABLE IF NOT EXISTS virtual_studio_scene_optimization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- User ID (no FK constraint to avoid dependency issues)
    project_id UUID,
    scene_id UUID,
    image_url TEXT,
    image_hash VARCHAR(64),
    before_score INTEGER, -- Composition score before optimization
    after_score INTEGER, -- Expected score after optimization
    optimization JSONB NOT NULL, -- {camera, lights, subjects, background}
    applied_optimizations JSONB, -- Which optimizations were actually applied
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for virtual_studio_scene_analysis
CREATE INDEX IF NOT EXISTS idx_virtual_studio_scene_analysis_user_id 
    ON virtual_studio_scene_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_studio_scene_analysis_project_id 
    ON virtual_studio_scene_analysis(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_virtual_studio_scene_analysis_scene_id 
    ON virtual_studio_scene_analysis(scene_id) WHERE scene_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_virtual_studio_scene_analysis_image_hash 
    ON virtual_studio_scene_analysis(image_hash) WHERE image_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_virtual_studio_scene_analysis_created_at 
    ON virtual_studio_scene_analysis(created_at);

-- Indexes for virtual_studio_pose_detection
CREATE INDEX IF NOT EXISTS idx_virtual_studio_pose_detection_user_id 
    ON virtual_studio_pose_detection(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_studio_pose_detection_project_id 
    ON virtual_studio_pose_detection(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_virtual_studio_pose_detection_scene_id 
    ON virtual_studio_pose_detection(scene_id) WHERE scene_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_virtual_studio_pose_detection_image_hash 
    ON virtual_studio_pose_detection(image_hash) WHERE image_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_virtual_studio_pose_detection_created_at 
    ON virtual_studio_pose_detection(created_at);

-- Indexes for virtual_studio_composition_history
CREATE INDEX IF NOT EXISTS idx_virtual_studio_composition_history_user_id 
    ON virtual_studio_composition_history(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_studio_composition_history_project_id 
    ON virtual_studio_composition_history(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_virtual_studio_composition_history_scene_id 
    ON virtual_studio_composition_history(scene_id) WHERE scene_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_virtual_studio_composition_history_created_at 
    ON virtual_studio_composition_history(created_at);

-- Indexes for virtual_studio_lighting_analysis
CREATE INDEX IF NOT EXISTS idx_virtual_studio_lighting_analysis_user_id 
    ON virtual_studio_lighting_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_studio_lighting_analysis_project_id 
    ON virtual_studio_lighting_analysis(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_virtual_studio_lighting_analysis_scene_id 
    ON virtual_studio_lighting_analysis(scene_id) WHERE scene_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_virtual_studio_lighting_analysis_created_at 
    ON virtual_studio_lighting_analysis(created_at);

-- Indexes for virtual_studio_scene_optimization
CREATE INDEX IF NOT EXISTS idx_virtual_studio_scene_optimization_user_id 
    ON virtual_studio_scene_optimization(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_studio_scene_optimization_project_id 
    ON virtual_studio_scene_optimization(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_virtual_studio_scene_optimization_scene_id 
    ON virtual_studio_scene_optimization(scene_id) WHERE scene_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_virtual_studio_scene_optimization_created_at 
    ON virtual_studio_scene_optimization(created_at);

-- Add comments
COMMENT ON TABLE virtual_studio_scene_analysis IS 'Stores comprehensive scene analysis results from SAM 2 and AI models';
COMMENT ON TABLE virtual_studio_pose_detection IS 'Stores body pose detection results from MediaPipe';
COMMENT ON TABLE virtual_studio_composition_history IS 'Tracks composition analysis history for learning and improvement';
COMMENT ON TABLE virtual_studio_lighting_analysis IS 'Stores lighting quality analysis results';
COMMENT ON TABLE virtual_studio_scene_optimization IS 'Tracks scene optimization attempts and results';


























