-- 0442_capture_client_token_view_state — klient-lese-kvittering på leverte galleri.
--
-- Fotografen har hittil bare sett «last_used_at» (sist klienten var innom noe).
-- Dette gir en ekte les-kvittering: NÅR åpnet klienten galleriet første gang, og
-- hvor mange ganger. Settes når klient-token laster /client/assets.
--
-- ADD COLUMN IF NOT EXISTS = idempotent/selvhelende: trygg å kjøre gjentatte
-- ganger, og appen degraderer grasiøst (les-state leses via defensiv raw-SQL som
-- faller til null/0 om kolonnene ennå ikke finnes).

ALTER TABLE capture_client_tokens ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ;
ALTER TABLE capture_client_tokens ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
