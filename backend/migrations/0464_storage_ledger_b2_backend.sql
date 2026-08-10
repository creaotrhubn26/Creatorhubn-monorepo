-- B2 er primærlager for opplastinger (upload-storage-router.ts). Ledgeren
-- fra 217_user_storage_consumption.sql kjente bare 'filesystem' | 'r2' |
-- 'cloudflare_stream'. En upload med p_backend = 'b2' ville derfor øke
-- total_bytes riktig, men falle ut av HELE breakdown'en — alle tre
-- kolonnene ville stå igjen uendret, og summen av dem ville ikke lenger
-- stemme med totalen.
--
-- Vi teller 'b2' i r2_bytes i stedet for å legge til en ny kolonne:
-- begge er objektlager, prisen regnes likt, og en kolonne-utvidelse ville
-- måtte følges opp i hver leser. Kolonnenavnet er historisk — kommentaren
-- under sier hva den faktisk inneholder.

COMMENT ON COLUMN user_storage_consumption.r2_bytes IS
  'Bytes i objektlager (B2 eller R2). Navnet er historisk — B2 ble primærlager senere.';

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
    CASE WHEN p_backend IN ('r2', 'b2') THEN GREATEST(0, p_delta_bytes) ELSE 0 END,
    CASE WHEN p_backend = 'cloudflare_stream' THEN GREATEST(0, p_delta_bytes) ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_bytes      = GREATEST(0, user_storage_consumption.total_bytes + p_delta_bytes),
    filesystem_bytes = CASE WHEN p_backend = 'filesystem'
                         THEN GREATEST(0, user_storage_consumption.filesystem_bytes + p_delta_bytes)
                         ELSE user_storage_consumption.filesystem_bytes END,
    r2_bytes         = CASE WHEN p_backend IN ('r2', 'b2')
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
