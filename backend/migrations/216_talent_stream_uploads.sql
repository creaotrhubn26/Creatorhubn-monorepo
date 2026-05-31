-- Talent Stream Uploads — Phase 6 tracking av Cloudflare Stream-status.
--
-- Når en talent laster opp en showreel, går den gjennom transkoding på
-- Stream's side. Vi sporer status fra `uploading` → `ready` (eller `error`)
-- via Cloudflare Stream webhooks. Frontend poller eller bruker dette for
-- å vise "Videoen din transkodes…" → "Klar!".
--
-- Webhook-respons fra Stream inneholder:
--   { uid, status: { state: 'ready'|'error', ...}, meta, ... }
-- Vi lagrer raw_event for debugging.

CREATE TABLE IF NOT EXISTS talent_stream_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  uid VARCHAR(64) NOT NULL UNIQUE,       -- Cloudflare Stream video UID
  status VARCHAR(20) NOT NULL DEFAULT 'uploading',
                                          -- uploading | queued | inprogress
                                          -- | ready | error | cancelled
  iframe_url TEXT,                        -- https://customer-{sub}.cloudflarestream.com/{uid}/iframe
  thumbnail_url TEXT,
  hls_manifest_url TEXT,
  duration_seconds NUMERIC(10,3),
  size_bytes BIGINT,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at TIMESTAMPTZ,
  error_message TEXT,
  raw_event JSONB,                        -- siste webhook payload
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS talent_stream_uploads_talent_idx ON talent_stream_uploads (talent_id);
CREATE INDEX IF NOT EXISTS talent_stream_uploads_status_idx ON talent_stream_uploads (status);
CREATE INDEX IF NOT EXISTS talent_stream_uploads_uid_idx ON talent_stream_uploads (uid);

DROP TRIGGER IF EXISTS update_talent_stream_uploads_updated_at ON talent_stream_uploads;
CREATE TRIGGER update_talent_stream_uploads_updated_at
  BEFORE UPDATE ON talent_stream_uploads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
