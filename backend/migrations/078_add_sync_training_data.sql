-- Add tables for collecting sync training data and model versioning
-- This enables fine-tuning models over time based on user corrections

-- Table to store sync training data (user adjustments)
CREATE TABLE IF NOT EXISTS sync_training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_arc_id VARCHAR REFERENCES story_arc_projects(id) ON DELETE CASCADE,
    user_id VARCHAR,
    
    -- Clip information
    clip_ids TEXT[] NOT NULL, -- Array of clip IDs that were synced
    reference_clip_id TEXT NOT NULL,
    
    -- Sync results
    auto_offset_seconds JSONB NOT NULL, -- Original calculated offsets: {clipId: offset}
    auto_confidence JSONB NOT NULL, -- Original confidence scores: {clipId: confidence}
    sync_method TEXT, -- 'synchformer', 'syncnet', 'hybrid'
    
    -- User corrections (ground truth)
    manual_offset_seconds JSONB, -- User-adjusted offsets: {clipId: offset}
    manual_adjustment_applied BOOLEAN DEFAULT false,
    
    -- Metadata
    camera_setup JSONB, -- Camera/angle information: {clipId: {camera, syncGroup}}
    video_metadata JSONB, -- Video properties: {clipId: {duration, fps, resolution}}
    
    -- Quality metrics
    original_avg_confidence DECIMAL(5,4), -- Average confidence before adjustment
    adjustment_magnitude DECIMAL(10,6), -- How much user changed offsets (RMS)
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_sync_training_data_story_arc;
DROP INDEX IF EXISTS idx_sync_training_data_user;
DROP INDEX IF EXISTS idx_sync_training_data_created;
DROP INDEX IF EXISTS idx_sync_training_data_adjusted;

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sync_training_data_story_arc ON sync_training_data(story_arc_id);
CREATE INDEX IF NOT EXISTS idx_sync_training_data_user ON sync_training_data(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_training_data_created ON sync_training_data(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_training_data_adjusted ON sync_training_data(manual_adjustment_applied) WHERE manual_adjustment_applied = true;

-- Table for fine-tuned model versions
CREATE TABLE IF NOT EXISTS sync_model_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_type TEXT NOT NULL, -- 'synchformer', 'syncnet', 'hybrid'
    version_number INTEGER NOT NULL,
    base_version TEXT, -- Original pretrained version
    
    -- Model storage
    storage_type TEXT DEFAULT 'r2', -- 'r2', 'local'
    r2_key TEXT, -- R2 storage key
    local_path TEXT, -- Local file path
    
    -- Training information
    training_data_count INTEGER DEFAULT 0, -- Number of samples used
    training_data_ids UUID[], -- IDs from sync_training_data used
    training_started_at TIMESTAMP WITH TIME ZONE,
    training_completed_at TIMESTAMP WITH TIME ZONE,
    training_duration_seconds INTEGER,
    
    -- Performance metrics
    validation_accuracy DECIMAL(5,4), -- Accuracy on validation set
    test_accuracy DECIMAL(5,4), -- Accuracy on test set
    improvement_over_base DECIMAL(5,4), -- Improvement percentage
    
    -- Status
    status TEXT DEFAULT 'training', -- 'training', 'completed', 'failed', 'active', 'deprecated'
    is_active BOOLEAN DEFAULT false, -- Currently in use
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(model_type, version_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sync_model_versions_type ON sync_model_versions(model_type);
CREATE INDEX IF NOT EXISTS idx_sync_model_versions_active ON sync_model_versions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sync_model_versions_status ON sync_model_versions(status);

-- Table to track which training data has been used
CREATE TABLE IF NOT EXISTS sync_training_data_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_data_id UUID REFERENCES sync_training_data(id) ON DELETE CASCADE,
    model_version_id UUID REFERENCES sync_model_versions(id) ON DELETE CASCADE,
    used_in_training BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(training_data_id, model_version_id)
);

-- View for training statistics
CREATE OR REPLACE VIEW sync_training_stats AS
SELECT 
    COUNT(*) as total_samples,
    COUNT(*) FILTER (WHERE manual_adjustment_applied = true) as adjusted_samples,
    AVG(original_avg_confidence) as avg_confidence,
    AVG(adjustment_magnitude) as avg_adjustment,
    MIN(created_at) as first_sample,
    MAX(created_at) as latest_sample
FROM sync_training_data;

-- Function to get latest model version
CREATE OR REPLACE FUNCTION get_latest_sync_model(model_type_param TEXT)
RETURNS sync_model_versions AS $$
    SELECT * FROM sync_model_versions
    WHERE model_type = model_type_param
    AND status = 'completed'
    AND is_active = true
    ORDER BY version_number DESC
    LIMIT 1;
$$ LANGUAGE SQL;

