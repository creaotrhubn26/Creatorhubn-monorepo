-- Add Audio Enhancement Models to ml_model_paths table
-- These models are stored in R2 using multipart upload (100MB parts)
-- The R2 service handles multipart uploads automatically

-- FullSubNet+ (Best noise reduction - CBAK 3.42, COVL 3.57)
-- Stored as: models/audio/fullsubnet/fullsubnet_plus.pth (104 MB)
INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('fullsubnet', 'r2', 'models/audio/fullsubnet/fullsubnet_plus.pth', 'models/audio/fullsubnet/fullsubnet_plus.pth', true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/audio/fullsubnet/fullsubnet_plus.pth',
  base_path = 'models/audio/fullsubnet/fullsubnet_plus.pth',
  updated_at = NOW();

-- FlowSE (MeanFlowSE) - Real-time speech enhancement
-- Stored as: models/audio/flowse/MeanFlowSE-Weights.ckpt (1.2 GB, uploaded via multipart)
INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('flowse', 'r2', 'models/audio/flowse/MeanFlowSE-Weights.ckpt', 'models/audio/flowse/MeanFlowSE-Weights.ckpt', true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/audio/flowse/MeanFlowSE-Weights.ckpt',
  base_path = 'models/audio/flowse/MeanFlowSE-Weights.ckpt',
  updated_at = NOW();

-- Note: DEMUCS and DeepFilterNet3 are auto-downloaded from their official sources,
-- so they don't need to be stored in R2. They will download automatically on first use.

-- Verify the entries
SELECT 
  model_type,
  storage_type,
  r2_key,
  base_path,
  is_active,
  updated_at
FROM ml_model_paths
WHERE model_type IN ('fullsubnet', 'flowse')
ORDER BY model_type;

