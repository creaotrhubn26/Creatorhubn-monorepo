-- Role Room storyboard animation jobs. `casting_projects.id` is VARCHAR, so
-- these jobs cannot safely share the workspace `generative_ai_jobs.project_id`
-- UUID contract.
CREATE TABLE IF NOT EXISTS project_ai_consent (
  project_id VARCHAR(255) PRIMARY KEY,
  consented BOOLEAN NOT NULL DEFAULT FALSE,
  consented_by VARCHAR(320),
  consented_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS storyboard_ai_video_jobs (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  storyboard_id UUID NOT NULL REFERENCES casting_storyboards(id) ON DELETE CASCADE,
  user_id VARCHAR(255),
  user_email VARCHAR(320),
  model VARCHAR(100) NOT NULL,
  kind VARCHAR(50) NOT NULL DEFAULT 'image-to-video',
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  provider VARCHAR(60) NOT NULL,
  fal_request_id VARCHAR(500),
  response_url TEXT,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_asset_id UUID,
  output_b2_key TEXT,
  output_url_temp TEXT,
  est_cost_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS storyboard_ai_video_jobs_project_idx
  ON storyboard_ai_video_jobs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS storyboard_ai_video_jobs_storyboard_idx
  ON storyboard_ai_video_jobs (storyboard_id, created_at DESC);

-- Image generations reserve daily budget before the provider call. Keeping
-- this separate from generative_ai_jobs avoids its UUID project_id contract.
CREATE TABLE IF NOT EXISTS storyboard_ai_image_usage (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  storyboard_id UUID NOT NULL REFERENCES casting_storyboards(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  model VARCHAR(100) NOT NULL,
  quality VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'reserved',
  est_cost_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
  billed_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
  billing_mode VARCHAR(30) NOT NULL,
  error VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS storyboard_ai_image_usage_daily_idx
  ON storyboard_ai_image_usage (created_at, status);
