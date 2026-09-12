ALTER TABLE IF EXISTS invite_requests
  ADD COLUMN IF NOT EXISTS source VARCHAR(100) DEFAULT 'landing',
  ADD COLUMN IF NOT EXISTS tester_profession VARCHAR(40),
  ADD COLUMN IF NOT EXISTS enterprise_team_size INTEGER,
  ADD COLUMN IF NOT EXISTS enterprise_pricing JSONB;

CREATE INDEX IF NOT EXISTS idx_invite_requests_prototype_queue
  ON invite_requests (status, created_at DESC)
  WHERE selected_plan = 'prototype_tester'
     OR source = 'prototype_tester_pricing';
