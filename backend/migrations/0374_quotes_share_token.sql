-- Sikring av klient-portal-lenker for tilbud (quotes).
-- De uautentiserte lese-endepunktene (GET /api/quotes/:id, /:id/pdf,
-- /status/:clientId) stolte tidligere på bar UUID som evig bærer-token.
-- Vi innfører en share_token (genereres når tilbudet sendes) + utløpstid.
-- Eksisterende rader forblir uten token og treffer «grace»-stien i koden
-- (bar-UUID godtas) slik at allerede utsendte klient-lenker ikke brytes.
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "share_token" varchar(64);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "share_expires_at" timestamptz;
CREATE INDEX IF NOT EXISTS "idx_quotes_share_token" ON "quotes" ("share_token");
