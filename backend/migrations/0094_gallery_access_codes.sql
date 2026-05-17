-- 0094_gallery_access_codes.sql
-- Korte 6-tegns access-koder for klienter som kommer via /portal-landingsside
-- istedenfor å bruke 32-tegn-tokens i URL-en. Stine kan administrere disse
-- per galleri (regenerere, revoker, sette utløp/max-uses). Klient skriver
-- inn koden, vi gjør lookup, og redirecter til /client-gallery/:access_token.
--
-- Koden er KUN en alias for access_token — selve gating-logikken (passord,
-- contract, count, payment) er uendret på download-endepunktet. Dette er
-- en ren UX-forbedring for å unngå lange URL-er i kundekommunikasjon.

CREATE TABLE IF NOT EXISTS gallery_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL,
  code VARCHAR(12) NOT NULL,                   -- 6 alfa-numeriske tegn (e.g. "MK7X9P")
  label VARCHAR(100),                          -- valgfritt navn ("Maria & Anders")
  expires_at TIMESTAMPTZ,                      -- NULL = ingen utløp
  max_uses INTEGER,                            -- NULL = ubegrenset
  use_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(64) NOT NULL,             -- photographer_id
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- Koden må være unik på tvers av aktive rader. Vi tillater duplicates
-- mellom revoked og aktive (samme code kan resykles senere).
CREATE UNIQUE INDEX IF NOT EXISTS gallery_access_codes_unique_active
  ON gallery_access_codes (code) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS gallery_access_codes_gallery_idx
  ON gallery_access_codes (gallery_id, is_active);
CREATE INDEX IF NOT EXISTS gallery_access_codes_created_by_idx
  ON gallery_access_codes (created_by, created_at DESC);

COMMENT ON COLUMN gallery_access_codes.code IS
  '6-tegns alfa-numerisk kode (ekskl. forvekslingsbare tegn 0/O/I/1). Klient skriver inn på /portal.';
COMMENT ON COLUMN gallery_access_codes.use_count IS
  'Antall ganger koden er brukt til oppslag. Brukes for telling mot max_uses.';
COMMENT ON COLUMN gallery_access_codes.is_active IS
  'Settes FALSE ved revoker. Inaktive koder blokkeres ved lookup men beholdes for audit.';
