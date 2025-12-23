-- Migration: Add SAM 2 Segmentation Results Cache Table
-- Purpose: Cache SAM 2 segmentation results to avoid re-processing same images/videos

CREATE TABLE IF NOT EXISTS sam2_segmentation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of image/video for deduplication
    image_url TEXT, -- Original image/video URL (optional, for reference)
    prompt_type VARCHAR(20) NOT NULL, -- 'point', 'box', 'auto'
    prompt_data JSONB, -- Prompt data (points, box coordinates, etc.)
    model_size VARCHAR(20) NOT NULL, -- 'tiny', 'small', 'base_plus', 'large'
    result_data JSONB NOT NULL, -- Cached segmentation result (masks, bboxes, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration for cache cleanup
    
    -- Indexes for fast lookups
    CONSTRAINT sam2_segmentation_results_image_hash_key UNIQUE (image_hash)
);

CREATE INDEX IF NOT EXISTS idx_sam2_segmentation_results_image_hash ON sam2_segmentation_results(image_hash);
CREATE INDEX IF NOT EXISTS idx_sam2_segmentation_results_created_at ON sam2_segmentation_results(created_at);
CREATE INDEX IF NOT EXISTS idx_sam2_segmentation_results_expires_at ON sam2_segmentation_results(expires_at) WHERE expires_at IS NOT NULL;

-- Add comments
COMMENT ON TABLE sam2_segmentation_results IS 'Cache for SAM 2 segmentation results to avoid re-processing same images/videos';
COMMENT ON COLUMN sam2_segmentation_results.image_hash IS 'SHA-256 hash of image/video for deduplication';
COMMENT ON COLUMN sam2_segmentation_results.prompt_type IS 'Type of prompt used: point, box, or auto';
COMMENT ON COLUMN sam2_segmentation_results.prompt_data IS 'JSON data containing prompt coordinates (points or box)';
COMMENT ON COLUMN sam2_segmentation_results.model_size IS 'SAM 2 model size used: tiny, small, base_plus, or large';
COMMENT ON COLUMN sam2_segmentation_results.result_data IS 'Cached segmentation result containing masks, bboxes, confidence scores';
COMMENT ON COLUMN sam2_segmentation_results.expires_at IS 'Optional expiration timestamp for automatic cache cleanup';
