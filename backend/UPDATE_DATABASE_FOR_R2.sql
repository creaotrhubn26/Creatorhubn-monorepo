-- Update GFPGAN configuration to use R2 storage
-- Run this after uploading models to R2

UPDATE ml_model_paths 
SET 
  storage_type = 'r2',
  r2_key = 'models/gfpgan',
  base_path = 'models/gfpgan',
  updated_at = NOW()
WHERE model_type = 'gfpgan';

-- Verify the update
SELECT 
  model_type,
  storage_type,
  r2_key,
  base_path,
  is_active,
  updated_at
FROM ml_model_paths
WHERE model_type = 'gfpgan';


