-- 0461_leadgrid_public_self_onboard_rate_limits.sql
-- Distributed, atomic fixed-window limiter for the unauthenticated Leadgrid
-- organization signup. Identities are SHA-256 hashes; raw IP/email values are
-- never persisted in this table.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtext('0461_leadgrid_public_rate_limits'));

CREATE TABLE IF NOT EXISTS leadgrid_public_rate_limit_buckets (
  scope VARCHAR(80) NOT NULL,
  key_hash CHAR(64) NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
  request_limit INTEGER NOT NULL CHECK (request_limit > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, key_hash, window_start),
  CONSTRAINT leadgrid_public_rate_limit_key_hash_check
    CHECK (key_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS leadgrid_public_rate_limit_buckets_window_idx
  ON leadgrid_public_rate_limit_buckets (window_start);

COMMIT;
