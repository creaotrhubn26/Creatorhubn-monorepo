-- User storage consumption — running ledger over hvor mange bytes hver
-- bruker har lagret i CreatorHub. Brukes til:
--   1. Quota-enforcement før chunked + single-shot uploads (returnerer
--      402/507 hvis plan-grensen er nådd)
--   2. Push metered usage til Stripe (subscriptionItems usage records)
--      slik at brukere automatisk faktureres for overforbruk
--
-- Tidligere fantes ingen sentral lagring av storage-bruk. Plan-grensene
-- var definert (Free 2GB, Basic 10GB, Pro 50GB, Premium 250GB, Enterprise
-- 1TB) men aldri sjekket — chunked uploads kunne push 80GB uten å bli
-- stoppet.

CREATE TABLE IF NOT EXISTS user_storage_consumption (
  user_id TEXT PRIMARY KEY,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  -- Breakdown per storage-backend, til reconciliation og diagnose
  filesystem_bytes BIGINT NOT NULL DEFAULT 0,
  r2_bytes BIGINT NOT NULL DEFAULT 0,
  stream_bytes BIGINT NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Sist gang vi pushet usage-record til Stripe
  last_stripe_sync_at TIMESTAMPTZ,
  -- Hva vi sist pushet (i GB, avrundet oppover) — så vi kan unngå
  -- redundante usage-records hvis ingenting har endret seg
  last_synced_overage_gb INTEGER,
  -- Notater fra siste reconciliation (f.eks. R2 mismatch)
  reconcile_notes TEXT,
  reconciled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS user_storage_overage_idx
  ON user_storage_consumption (total_bytes DESC);

-- Audit-tabell: hver storage-event som påvirket ledgeren.
-- Bruker dette til (a) forklare hvorfor en brukers ledger er der den er,
-- (b) reconciliation hvis Stripe sync krasjer.
CREATE TABLE IF NOT EXISTS storage_consumption_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  delta_bytes BIGINT NOT NULL,
    -- Positiv = upload, negativ = sletting/cleanup
  backend TEXT NOT NULL,
    -- 'filesystem' | 'r2' | 'cloudflare_stream'
  reason TEXT NOT NULL,
    -- f.eks. 'chunked_finish', 'single_upload', 'chunked_cancel',
    -- 'cleanup_expired', 'reconcile_r2', 'admin_adjustment'
  related_resource_id TEXT,
    -- f.eks. chunked_uploads.id eller file_id
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storage_events_user_idx
  ON storage_consumption_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS storage_events_resource_idx
  ON storage_consumption_events (related_resource_id)
  WHERE related_resource_id IS NOT NULL;

-- Trinn-funksjon: oppdater ledger atomisk + audit-event.
-- Bruk: SELECT apply_storage_consumption_delta(
--   p_user_id := 'user-uuid',
--   p_delta_bytes := 1048576,
--   p_backend := 'r2',
--   p_reason := 'chunked_finish',
--   p_related := 'upload-id',
--   p_metadata := '{}'::jsonb
-- );
CREATE OR REPLACE FUNCTION apply_storage_consumption_delta(
  p_user_id TEXT,
  p_delta_bytes BIGINT,
  p_backend TEXT,
  p_reason TEXT,
  p_related TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS BIGINT AS $$
DECLARE
  new_total BIGINT;
BEGIN
  INSERT INTO user_storage_consumption (
    user_id, total_bytes, filesystem_bytes, r2_bytes, stream_bytes,
    last_updated
  )
  VALUES (
    p_user_id,
    GREATEST(0, p_delta_bytes),
    CASE WHEN p_backend = 'filesystem' THEN GREATEST(0, p_delta_bytes) ELSE 0 END,
    CASE WHEN p_backend = 'r2' THEN GREATEST(0, p_delta_bytes) ELSE 0 END,
    CASE WHEN p_backend = 'cloudflare_stream' THEN GREATEST(0, p_delta_bytes) ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_bytes      = GREATEST(0, user_storage_consumption.total_bytes + p_delta_bytes),
    filesystem_bytes = CASE WHEN p_backend = 'filesystem'
                         THEN GREATEST(0, user_storage_consumption.filesystem_bytes + p_delta_bytes)
                         ELSE user_storage_consumption.filesystem_bytes END,
    r2_bytes         = CASE WHEN p_backend = 'r2'
                         THEN GREATEST(0, user_storage_consumption.r2_bytes + p_delta_bytes)
                         ELSE user_storage_consumption.r2_bytes END,
    stream_bytes     = CASE WHEN p_backend = 'cloudflare_stream'
                         THEN GREATEST(0, user_storage_consumption.stream_bytes + p_delta_bytes)
                         ELSE user_storage_consumption.stream_bytes END,
    last_updated     = now()
  RETURNING total_bytes INTO new_total;

  INSERT INTO storage_consumption_events (
    user_id, delta_bytes, backend, reason, related_resource_id, metadata
  )
  VALUES (
    p_user_id, p_delta_bytes, p_backend, p_reason, p_related, p_metadata
  );

  RETURN new_total;
END;
$$ LANGUAGE plpgsql;

-- Legg på en kolonne for å koble en Stripe-subscription til en
-- spesifikk metered subscription-item som vi pusher storage-bruk til.
-- Dette unngår at vi må slå opp items hver gang via Stripe API.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_storage_meter_item_id VARCHAR;
