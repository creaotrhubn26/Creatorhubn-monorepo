-- Migration: Add DiffBIR model configuration
-- DiffBIR: Diffusion-Based Blind Image Restoration
-- Supports: super-resolution, denoising, face restoration, unaligned face restoration

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
  'diffbir',
  'v2.1',
  '/Volumes/Samsung_T9_4TB1/pretrained_models/diffbir',
  '~/gfpgan_env/bin/python',
  'inference.py',
  'production',
  'DiffBIR v2.1: Diffusion-based blind image restoration for super-resolution, denoising, and face restoration. Works on full-body images.',
  'local',
  NULL
) ON CONFLICT (model_type) DO UPDATE SET
  model_version = EXCLUDED.model_version,
  base_path = EXCLUDED.base_path,
  python_env_path = EXCLUDED.python_env_path,
  inference_script_path = EXCLUDED.inference_script_path,
  description = EXCLUDED.description,
  updated_at = NOW();

