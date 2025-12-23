-- Migration: Add Real-ESRGAN model configuration
-- Real-ESRGAN for super-resolution upscaling (2x, 4x, 8x)

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
  'real-esrgan',
  '1.0',
  '/Volumes/Samsung_T9_4TB1/pretrained_models/realesrgan',
  '~/gfpgan_env/bin/python',
  'inference_realesrgan.py',
  'production',
  'Real-ESRGAN super-resolution model for 2x/4x/8x upscaling with face enhancement option',
  'local',
  NULL
) ON CONFLICT (model_type) DO UPDATE SET
  model_version = EXCLUDED.model_version,
  base_path = EXCLUDED.base_path,
  python_env_path = EXCLUDED.python_env_path,
  inference_script_path = EXCLUDED.inference_script_path,
  description = EXCLUDED.description,
  updated_at = NOW();
