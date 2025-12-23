-- Add SAM 2 Motion Tracking Training Data Schema
-- This table stores user corrections to SAM 2 tracking results for fine-tuning

CREATE TABLE IF NOT EXISTS sam2_training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Video and clip information
    story_arc_id UUID,  -- Optional reference (no FK constraint to avoid dependency issues)
    user_id TEXT NOT NULL,
    video_clip_id TEXT NOT NULL,
    
    -- Initial tracking (what SAM 2 predicted)
    initial_bbox JSONB NOT NULL,  -- [x, y, width, height] at frame 0
    initial_frame INTEGER NOT NULL DEFAULT 0,
    tracking_method TEXT NOT NULL DEFAULT 'sam2',  -- 'sam2', 'opencv', etc.
    model_size TEXT,  -- 'tiny', 'small', 'base_plus', 'large'
    
    -- Tracking results (SAM 2 predictions across frames)
    predicted_tracking JSONB NOT NULL,  -- Array of {frame, bbox, confidence, mask_available}
    
    -- User corrections (ground truth)
    corrected_tracking JSONB,  -- Array of {frame, bbox, confidence} - user corrections
    correction_applied BOOLEAN DEFAULT false,
    
    -- Metadata
    video_metadata JSONB,  -- Video properties: fps, resolution, duration
    object_type TEXT,  -- 'person', 'vehicle', 'object', etc.
    tracking_quality TEXT,  -- 'good', 'needs_correction', 'failed'
    
    -- Performance metrics
    original_avg_confidence NUMERIC,
    corrected_avg_confidence NUMERIC,
    correction_magnitude NUMERIC,  -- Average pixel difference in bbox
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sam2_training_data_story_arc ON sam2_training_data(story_arc_id);
CREATE INDEX IF NOT EXISTS idx_sam2_training_data_user ON sam2_training_data(user_id);
CREATE INDEX IF NOT EXISTS idx_sam2_training_data_correction ON sam2_training_data(correction_applied);
CREATE INDEX IF NOT EXISTS idx_sam2_training_data_created ON sam2_training_data(created_at DESC);

-- SAM 2 Model Versions table (for tracking fine-tuned models)
CREATE TABLE IF NOT EXISTS sam2_model_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    model_type TEXT NOT NULL,  -- 'sam2-tiny', 'sam2-small', etc.
    version_number INTEGER NOT NULL,
    base_model_version TEXT,  -- Original pretrained model version
    
    -- Training info
    training_data_count INTEGER NOT NULL DEFAULT 0,
    training_samples_used JSONB,  -- IDs of training samples used
    
    -- Performance metrics
    validation_accuracy NUMERIC,  -- Tracking accuracy on validation set
    test_accuracy NUMERIC,  -- Tracking accuracy on test set
    improvement_over_base NUMERIC,  -- Percentage improvement
    
    -- Model storage
    storage_type TEXT NOT NULL DEFAULT 'r2',  -- 'r2', 'local'
    r2_key TEXT,  -- Path in R2 storage
    local_path TEXT,  -- Local file path
    
    -- Status
    status TEXT NOT NULL DEFAULT 'training',  -- 'training', 'completed', 'failed'
    is_active BOOLEAN DEFAULT false,
    
    -- Timestamps
    training_started_at TIMESTAMP WITH TIME ZONE,
    training_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(model_type, version_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sam2_model_versions_type ON sam2_model_versions(model_type);
CREATE INDEX IF NOT EXISTS idx_sam2_model_versions_active ON sam2_model_versions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sam2_model_versions_status ON sam2_model_versions(status);

-- SAM 2 Training Data Usage (track which samples were used for which model versions)
CREATE TABLE IF NOT EXISTS sam2_training_data_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_data_id UUID NOT NULL REFERENCES sam2_training_data(id) ON DELETE CASCADE,
    model_version_id UUID NOT NULL REFERENCES sam2_model_versions(id) ON DELETE CASCADE,
    used_in_training BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(training_data_id, model_version_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sam2_training_data_usage_data ON sam2_training_data_usage(training_data_id);
CREATE INDEX IF NOT EXISTS idx_sam2_training_data_usage_version ON sam2_training_data_usage(model_version_id);

-- Comments
COMMENT ON TABLE sam2_training_data IS 'User corrections to SAM 2 tracking results for fine-tuning';
COMMENT ON TABLE sam2_model_versions IS 'Fine-tuned SAM 2 model versions';
COMMENT ON TABLE sam2_training_data_usage IS 'Tracks which training samples were used for each model version';
