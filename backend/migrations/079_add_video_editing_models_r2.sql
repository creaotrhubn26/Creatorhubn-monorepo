-- Add Video Editing Models to ml_model_paths table
-- Scene Detection, Motion Tracking, Color Correction, Video Denoising

-- Scene Detection (PySceneDetect - no model files, library-based)
INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('scene-detection', 'local', NULL, 'scenedetect', true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'local',
  base_path = 'scenedetect',
  updated_at = NOW();

-- Motion Tracking - SAM 2 Models (2025)
INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('sam2-tiny', 'r2', 'models/sam2/sam2_hiera_tiny.pt', NULL, true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/sam2/sam2_hiera_tiny.pt',
  updated_at = NOW();

INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('sam2-small', 'r2', 'models/sam2/sam2_hiera_small.pt', NULL, true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/sam2/sam2_hiera_small.pt',
  updated_at = NOW();

INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('sam2-base-plus', 'r2', 'models/sam2/sam2_hiera_base_plus.pt', NULL, true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/sam2/sam2_hiera_base_plus.pt',
  updated_at = NOW();

INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('sam2-large', 'r2', 'models/sam2/sam2_hiera_large.pt', NULL, true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/sam2/sam2_hiera_large.pt',
  updated_at = NOW();

-- Motion Tracking (OpenCV-based fallback, no separate model files)
INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('motion-tracking-opencv', 'local', NULL, 'opencv', true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'local',
  base_path = 'opencv',
  updated_at = NOW();

-- REMBG Models
INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('rembg-u2net', 'r2', 'models/rembg/u2net/u2net.onnx', NULL, true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/rembg/u2net/u2net.onnx',
  updated_at = NOW();

INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('rembg-isnet', 'r2', 'models/rembg/isnet/isnet-general-use.onnx', NULL, true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/rembg/isnet/isnet-general-use.onnx',
  updated_at = NOW();

INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('rembg-birefnet', 'r2', 'models/rembg/birefnet/birefnet.onnx', NULL, true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/rembg/birefnet/birefnet.onnx',
  updated_at = NOW();

-- Whisper Models
INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('whisper-tiny', 'r2', 'models/whisper/tiny.pt', NULL, true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/whisper/tiny.pt',
  updated_at = NOW();

INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('whisper-base', 'r2', 'models/whisper/base.pt', NULL, true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/whisper/base.pt',
  updated_at = NOW();

INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('whisper-small', 'r2', 'models/whisper/small.pt', NULL, true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/whisper/small.pt',
  updated_at = NOW();

INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('whisper-medium', 'r2', 'models/whisper/medium.pt', NULL, true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/whisper/medium.pt',
  updated_at = NOW();

INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('whisper-large', 'r2', 'models/whisper/large-v2.pt', NULL, true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'r2',
  r2_key = 'models/whisper/large-v2.pt',
  updated_at = NOW();

-- Color Correction (algorithm-based, no model files)
INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('color-correction', 'local', NULL, 'opencv', true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'local',
  base_path = 'opencv',
  updated_at = NOW();

-- Video Denoising (RealESRGAN optional, OpenCV fallback)
INSERT INTO ml_model_paths (model_type, storage_type, r2_key, base_path, is_active, created_at, updated_at)
VALUES ('video-denoising', 'local', NULL, 'opencv', true, NOW(), NOW())
ON CONFLICT (model_type) DO UPDATE SET
  storage_type = 'local',
  base_path = 'opencv',
  updated_at = NOW();

-- Verify all models were added
SELECT 
  model_type,
  storage_type,
  r2_key,
  base_path,
  is_active
FROM ml_model_paths
WHERE model_type IN (
  'scene-detection',
  'sam2-tiny',
  'sam2-small',
  'sam2-base-plus',
  'sam2-large',
  'motion-tracking-opencv',
  'rembg-u2net',
  'rembg-isnet',
  'rembg-birefnet',
  'whisper-tiny',
  'whisper-base',
  'whisper-small',
  'whisper-medium',
  'whisper-large',
  'color-correction',
  'video-denoising'
)
ORDER BY model_type;

