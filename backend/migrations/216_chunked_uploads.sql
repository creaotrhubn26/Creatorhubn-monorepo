-- Chunked uploads — resumable opplasting for store RAW/PSD/video-filer.
--
-- Tidligere brukte UniversalFileUpload single-shot multipart uploads med
-- max 200MB-1GB per fil. Hvis nettverket dropped midt i en 80GB bryllups-
-- RAW-upload måtte Fredrik starte ALT på nytt. Dette er rot-fixen for B5:
-- chunked persistens på serversiden så client kan resume etter brutt
-- forbindelse, app-restart eller bytte av nettverk.
--
-- Hver upload deles i N chunks. Backend lagrer hver chunk på filsystemet,
-- sporer mottatte chunks i `received_chunks` (sparse-array). Når alle
-- chunks er mottatt kan klient kalle /finish som assembler dem til én fil.

CREATE TABLE IF NOT EXISTS chunked_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  chunk_size INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  received_chunks JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Liste av chunk-indekser som er mottatt. Sortert numerisk når brukt.
  status TEXT NOT NULL DEFAULT 'in_progress',
    -- in_progress: aktiv upload
    -- completed: alle chunks mottatt + assemblet til endelig fil
    -- failed: noe gikk galt under assembly
    -- expired: upload var inaktiv lenger enn expires_at (cleanup)
    -- cancelled: bruker avbrøt
  mime_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
    -- Frontend kan sende vilkårlig metadata (projectId, captureSessionId, etc.)
  final_file_id TEXT,
    -- Settes ved 'completed' — referanse til den ferdig-assemblerte fila
  final_file_path TEXT,
    -- Lokal sti der ferdig fil ligger (relativ til CHUNKED_UPLOAD_DIR)
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS chunked_uploads_user_idx
  ON chunked_uploads (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chunked_uploads_status_idx
  ON chunked_uploads (status, expires_at)
  WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS chunked_uploads_cleanup_idx
  ON chunked_uploads (expires_at)
  WHERE status IN ('completed', 'expired', 'failed', 'cancelled');
