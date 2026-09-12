-- 0384: Fakturering av AI-strukturering (2026-07-17). Kobler leadbook_ai_usage
-- på samme overage-løype som partner-API-et (leadgrid-overage-billing.ts):
-- daglig cron aggregerer ufakturerte kall per org → Stripe meter-event →
-- radene stemples billed_at.

ALTER TABLE leadbook_ai_usage
  ADD COLUMN IF NOT EXISTS billed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_lb_ai_usage_unbilled
  ON leadbook_ai_usage (organization_id, created_at)
  WHERE billed_at IS NULL;
