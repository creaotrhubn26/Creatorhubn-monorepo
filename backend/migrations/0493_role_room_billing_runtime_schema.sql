-- 0493_role_room_billing_runtime_schema.sql
--
-- Durable audit dataflow for Role Room seat changes and Stripe-sync alerts.
-- This migration does not alter Stripe subscriptions, quantities or plans.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtext('0493_role_room_billing_runtime_schema'));

CREATE TABLE IF NOT EXISTS role_room_seat_changes (
  id BIGSERIAL PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  owner_user_id VARCHAR(255) NOT NULL,
  actor_user_id VARCHAR(255) NOT NULL,
  from_quantity INTEGER NOT NULL,
  to_quantity INTEGER NOT NULL,
  seats_added INTEGER NOT NULL,
  estimated_extra_cost_minor INTEGER NOT NULL,
  stripe_subscription_id VARCHAR(255),
  stripe_subscription_item_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT role_room_seat_changes_from_quantity_check CHECK (from_quantity >= 0),
  CONSTRAINT role_room_seat_changes_to_quantity_check CHECK (to_quantity >= 0)
);
CREATE INDEX IF NOT EXISTS idx_rr_seat_changes_project
  ON role_room_seat_changes (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_seat_changes_owner
  ON role_room_seat_changes (owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS role_room_billing_alerts (
  id BIGSERIAL PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  owner_user_id VARCHAR(255) NOT NULL,
  actor_user_id VARCHAR(255) NOT NULL,
  kind VARCHAR(64) NOT NULL,
  detail TEXT NOT NULL,
  stripe_subscription_id VARCHAR(255),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id VARCHAR(255),
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rr_billing_alerts_unresolved
  ON role_room_billing_alerts (created_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rr_billing_alerts_project
  ON role_room_billing_alerts (project_id, created_at DESC);

COMMIT;
