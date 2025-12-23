-- Add SyncNet Model Weights to ml_model_paths table
-- These models are stored in R2 using multipart upload (100MB parts)
-- The R2 service handles multipart uploads automatically

-- sfd_face.pth (Face Detection Model - S3FD)
-- Stored as: models/video-sync/sfd_face.pth (85.7 MB)
INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('syncnet-sfd', 'r2', 'models/video-sync/sfd_face.pth', 'models/video-sync/sfd_face.pth', true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/video-sync/sfd_face.pth',
  base_path = 'models/video-sync/sfd_face.pth',
  updated_at = NOW();

-- syncnet_v2.model (SyncNet Audio-Visual Synchronization Model)
-- Stored as: models/video-sync/syncnet_v2.model (52.0 MB)
INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('syncnet-v2', 'r2', 'models/video-sync/syncnet_v2.model', 'models/video-sync/syncnet_v2.model', true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/video-sync/syncnet_v2.model',
  base_path = 'models/video-sync/syncnet_v2.model',
  updated_at = NOW();

-- Verify the entries
SELECT 
  model_type,
  storage_type,
  r2_key,
  base_path,
  is_active,
  updated_at
FROM ml_model_paths
WHERE model_type IN ('syncnet-sfd', 'syncnet-v2')
ORDER BY model_type;

