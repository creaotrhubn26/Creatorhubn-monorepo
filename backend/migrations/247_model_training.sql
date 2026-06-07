-- 247_model_training.sql
--
-- Skjema for fine-tuning-monitor-fanen i Admin Room.
-- Driver `/api/training-monitoring/*` + `/api/video-sync/training-data/*` +
-- `/api/video-sync/model-versions` (admin-training-monitoring-routes.ts).
--
-- Tabellene er minimal-implementasjon: rute-laget er defensiv (to_regclass)
-- mot manglende tabeller, så seed-feil bryter ikke UI-en.

CREATE TABLE IF NOT EXISTS ml_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  model_type TEXT NOT NULL, -- 'video-sync' | 'lipsync' | 'classifier' | 'recommender' | 'lighting' | 'sam2'
  status TEXT NOT NULL DEFAULT 'idle', -- 'idle' | 'training' | 'deployed' | 'failed'
  current_version TEXT NOT NULL DEFAULT 'v0.0.0',
  is_production BOOLEAN NOT NULL DEFAULT FALSE,
  storage_type TEXT NOT NULL DEFAULT 'r2', -- 'r2' | 'local' | 'huggingface'
  r2_key TEXT,
  base_path TEXT,
  last_trained_at TIMESTAMPTZ,
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ml_model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES ml_models(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'completed', -- 'training' | 'completed' | 'failed' | 'deployed'
  trained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  training_completed_at TIMESTAMPTZ,
  training_duration_minutes INTEGER,
  training_data_count INTEGER NOT NULL DEFAULT 0,
  accuracy NUMERIC(5,4),
  validation_accuracy NUMERIC(5,4),
  test_accuracy NUMERIC(5,4),
  loss NUMERIC(10,6),
  is_deployed BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  artifacts_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, version)
);

CREATE TABLE IF NOT EXISTS ml_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES ml_models(id) ON DELETE CASCADE,
  dataset_name TEXT NOT NULL,
  sample_count INTEGER NOT NULL DEFAULT 0,
  adjusted_count INTEGER NOT NULL DEFAULT 0, -- subset which has been manually corrected
  total_size_bytes BIGINT NOT NULL DEFAULT 0,
  avg_confidence NUMERIC(6,4),
  avg_adjustment NUMERIC(10,6),
  format TEXT, -- 'video' | 'audio' | 'image' | 'text'
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ml_model_versions_model_idx
  ON ml_model_versions (model_id, trained_at DESC);

CREATE INDEX IF NOT EXISTS ml_training_data_model_idx
  ON ml_training_data (model_id, collected_at DESC);

-- Seed 2 demo-models (idempotent — ON CONFLICT DO NOTHING på name-unique).
INSERT INTO ml_models (
  name,
  display_name,
  model_type,
  status,
  current_version,
  is_production,
  storage_type,
  r2_key,
  last_trained_at,
  metrics
)
VALUES
  (
    'lipsync-v1',
    'Lipsync Model v1',
    'lipsync',
    'deployed',
    'v1.2.0',
    TRUE,
    'r2',
    'models/lipsync/lipsync-v1.2.0.pth',
    now() - interval '7 days',
    '{"latency_ms": 124, "wer": 0.087}'::jsonb
  ),
  (
    'video-sync-default',
    'Video Sync Default',
    'video-sync',
    'idle',
    'v0.5.0',
    FALSE,
    'r2',
    'models/video-sync/sfd_face.pth',
    now() - interval '21 days',
    '{"sync_error_ms": 18.4}'::jsonb
  )
ON CONFLICT (name) DO NOTHING;

-- Seed én versjon pr. modell så Fine-Tuned Model Versions-tabellen ikke er tom.
INSERT INTO ml_model_versions (
  model_id,
  version,
  version_number,
  status,
  trained_at,
  training_completed_at,
  training_duration_minutes,
  training_data_count,
  accuracy,
  validation_accuracy,
  test_accuracy,
  loss,
  is_deployed,
  is_active
)
SELECT
  m.id,
  m.current_version,
  1,
  CASE WHEN m.status = 'deployed' THEN 'deployed' ELSE 'completed' END,
  COALESCE(m.last_trained_at, now() - interval '7 days'),
  COALESCE(m.last_trained_at, now() - interval '7 days'),
  CASE WHEN m.model_type = 'lipsync' THEN 240 ELSE 90 END,
  CASE WHEN m.model_type = 'lipsync' THEN 4200 ELSE 1800 END,
  CASE WHEN m.model_type = 'lipsync' THEN 0.9132 ELSE 0.8541 END,
  CASE WHEN m.model_type = 'lipsync' THEN 0.9011 ELSE 0.8377 END,
  CASE WHEN m.model_type = 'lipsync' THEN 0.8907 ELSE 0.8214 END,
  CASE WHEN m.model_type = 'lipsync' THEN 0.0421 ELSE 0.1129 END,
  m.is_production,
  m.is_production
FROM ml_models m
WHERE NOT EXISTS (
  SELECT 1 FROM ml_model_versions v WHERE v.model_id = m.id
);

-- Seed treningsdata-statistikk pr. modell.
INSERT INTO ml_training_data (
  model_id,
  dataset_name,
  sample_count,
  adjusted_count,
  total_size_bytes,
  avg_confidence,
  avg_adjustment,
  format,
  collected_at
)
SELECT
  m.id,
  m.name || '-dataset',
  CASE WHEN m.model_type = 'lipsync' THEN 4200 ELSE 1800 END,
  CASE WHEN m.model_type = 'lipsync' THEN 312 ELSE 184 END,
  CASE WHEN m.model_type = 'lipsync' THEN 18532493824 ELSE 9821847552 END,
  CASE WHEN m.model_type = 'lipsync' THEN 0.8732 ELSE 0.7944 END,
  CASE WHEN m.model_type = 'lipsync' THEN 0.0184 ELSE 0.0421 END,
  CASE WHEN m.model_type = 'lipsync' THEN 'audio' ELSE 'video' END,
  now() - interval '14 days'
FROM ml_models m
WHERE NOT EXISTS (
  SELECT 1 FROM ml_training_data d WHERE d.model_id = m.id
);
