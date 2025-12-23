-- Migration: Add R2 Cloud Storage Support to ML Model Paths
-- Adds storage_type and r2_key columns to support cloud storage

-- Add new columns
ALTER TABLE ml_model_paths 
ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'local',
ADD COLUMN IF NOT EXISTS r2_key TEXT;

-- Create index for storage type lookups
CREATE INDEX IF NOT EXISTS idx_ml_model_paths_storage_type ON ml_model_paths(storage_type);

-- Update existing records to have 'local' storage type
UPDATE ml_model_paths 
SET storage_type = 'local' 
WHERE storage_type IS NULL;

-- Add comment
COMMENT ON COLUMN ml_model_paths.storage_type IS 'Storage type: local, r2, s3, gcs';
COMMENT ON COLUMN ml_model_paths.r2_key IS 'R2 object key if storage_type is r2';


