-- Gallery magic-links — tokenized klient-tilgang til et bundle med fil-IDer.
--
-- Brukstilfelle: fotograf laster opp 800 bryllupsbilder med encryptAtRest=true,
-- oppretter en magic-link knyttet til brudeparets e-post, sender lenken.
-- Brudeparet klikker → får tilgang til sitt galleri uten å opprette
-- CreatorHub-konto. Backend dekrypterer i sanntid og serverer plaintext.
--
-- Sikkerhet:
--   - Token er 32 bytes random → 256 bits entropy, ikke gjettbar
--   - expires_at håndhevet ved hvert kall
--   - max_downloads cap forhindrer at en lekket lenke kan bli misbrukt
--     i det uendelige
--   - revoked_at lar fotografen kansellere lenken hvis kunden klager
--   - per-IP throttling implementert i route-laget

CREATE TABLE IF NOT EXISTS gallery_magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
    -- 32-byte url-safe base64 = 43 tegn etter strip av padding
  owner_user_id TEXT NOT NULL,
    -- Hvem som opprettet lenken (fotograf)
  recipient_label TEXT,
    -- Fri tekst: "Anna & Ole bryllup", "Familien Olsen", etc.
  recipient_email TEXT,
    -- Eposten lenken ble sendt til (audit + visning i admin)
  file_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Array av chunked_uploads.final_file_id som denne lenken grants tilgang til
  gallery_name TEXT,
    -- Vises i klient-UI ("Bryllupsbildene dine, 15. mai 2026")
  message TEXT,
    -- Valgfri velkomstmelding fra fotografen som vises på landing
  expires_at TIMESTAMPTZ NOT NULL,
    -- Hard cap. Backend nekter tilgang etter dette punktet
  max_downloads INTEGER,
    -- NULL = ubegrenset
  downloads_used INTEGER NOT NULL DEFAULT 0,
  zip_downloads_used INTEGER NOT NULL DEFAULT 0,
    -- ZIP-nedlasting telles separat (kostbar, vil cap eksplisitt)
  max_zip_downloads INTEGER DEFAULT 5,
    -- ZIP-cap default 5 — forhindrer at noen leeker lenken til en
    -- scraper som hammer på zip-endepunktet
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  revoke_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMPTZ,
  -- Frikolonne for ekstra metadata (kunde-kontekst, prosjekt-id, etc.)
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS gallery_magic_links_token_idx
  ON gallery_magic_links (token);

CREATE INDEX IF NOT EXISTS gallery_magic_links_owner_idx
  ON gallery_magic_links (owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gallery_magic_links_active_idx
  ON gallery_magic_links (expires_at)
  WHERE revoked_at IS NULL;

-- Audit-tabell: hver gang token blir brukt (success eller failed).
-- Lar oss svare på "hvem hentet hva, fra hvor, når" forensisk.
CREATE TABLE IF NOT EXISTS gallery_magic_link_access (
  id BIGSERIAL PRIMARY KEY,
  link_id UUID NOT NULL REFERENCES gallery_magic_links(id) ON DELETE CASCADE,
  file_id TEXT,
    -- NULL hvis aksessen var på manifest eller ZIP (ikke en spesifikk fil)
  access_type TEXT NOT NULL,
    -- 'manifest' | 'file' | 'zip' | 'rejected'
  outcome TEXT NOT NULL,
    -- 'success' | 'expired' | 'revoked' | 'over_quota' |
    -- 'invalid_file_id' | 'decrypt_failed' | 'rate_limited'
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  bytes_served BIGINT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gallery_magic_link_access_link_idx
  ON gallery_magic_link_access (link_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gallery_magic_link_access_recent_idx
  ON gallery_magic_link_access (created_at DESC);

CREATE INDEX IF NOT EXISTS gallery_magic_link_access_failures_idx
  ON gallery_magic_link_access (outcome, created_at DESC)
  WHERE outcome != 'success';
