-- Migration: Add FaceXFormer model configuration
-- FaceXFormer: Fine-tuned face analysis model
-- Stored in R2 as split parts (50MB chunks)

-- Create table if it doesn't exist (from migration 070)
CREATE TABLE IF NOT EXISTS ml_model_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type VARCHAR(50) NOT NULL UNIQUE,
  model_version VARCHAR(20),
  base_path TEXT NOT NULL,
  python_env_path TEXT,
  inference_script_path TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  environment VARCHAR(20) DEFAULT 'production',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Ensure R2 storage columns exist (from migration 071)
ALTER TABLE ml_model_paths 
ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'local',
ADD COLUMN IF NOT EXISTS r2_key TEXT;

-- Insert or update FaceXFormer configuration
INSERT INTO ml_model_paths (
  model_type,
  model_version,
  base_path,
  python_env_path,
  inference_script_path,
  environment,
  description,
  storage_type,
  r2_key
) VALUES (
  'facexformer',
  'trained',
  '/Users/usmanqazi/creatorhub-backend/python_ml_service/training/facexformer/checkpoints',
  NULL,
  NULL,
  'production',
  'FaceXFormer: Fine-tuned face analysis model for landmarks, attributes, and expressions. Trained on custom dataset. Stored in R2 as split parts.',
  'r2',
  'models/facexformer/best_model.pt'
) ON CONFLICT (model_type) DO UPDATE SET
  model_version = EXCLUDED.model_version,
  base_path = EXCLUDED.base_path,
  storage_type = EXCLUDED.storage_type,
  r2_key = EXCLUDED.r2_key,
  description = EXCLUDED.description,
  updated_at = NOW();

