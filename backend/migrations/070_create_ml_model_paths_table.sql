-- Migration: Create ML Model Paths Table
-- Stores configuration for ML model locations (GFPGAN, Real-ESRGAN, etc.)
-- Allows dynamic configuration without code changes

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

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ml_model_paths_model_type ON ml_model_paths(model_type);
CREATE INDEX IF NOT EXISTS idx_ml_model_paths_is_active ON ml_model_paths(is_active);
CREATE INDEX IF NOT EXISTS idx_ml_model_paths_environment ON ml_model_paths(environment);

-- Insert initial GFPGAN configuration
INSERT INTO ml_model_paths (
  model_type,
  model_version,
  base_path,
  python_env_path,
  inference_script_path,
  environment,
  description
) VALUES (
  'gfpgan',
  '1.3',
  '/Volumes/Samsung_T9_4TB1/pretrained_models/gfpgan',
  '~/gfpgan_env/bin/python',
  'inference_gfpgan.py',
  'production',
  'GFPGAN v1.3 face restoration model - configured per GFPGAN_SUCCESS.md'
) ON CONFLICT (model_type) DO NOTHING;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ml_model_paths_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ml_model_paths_updated_at
  BEFORE UPDATE ON ml_model_paths
  FOR EACH ROW
  EXECUTE FUNCTION update_ml_model_paths_updated_at();


