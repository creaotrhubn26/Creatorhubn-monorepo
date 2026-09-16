-- Norsk eID (BankID/Buypass) — identitetsverifisering for talents.
--
-- Registeret er selvrapportert i dag: hvem som helst kan skrive at de hadde
-- hovedrollen på Nationaltheatret. Verifisert identitet er det byråene
-- faktisk betaler for, og forutsetningen for å håndtere mindreårige riktig.
--
-- 🔑 Fødselsnummer lagres ALDRI, heller ikke kryptert. Vi lagrer en HMAC av
-- det (ssn_hash), med en serverside-pepper. Hashen er kontonøkkelen fordi
-- BankID og Buypass gir ulik `sub` for samme person — binder man på `sub`,
-- får samme skuespiller to identiteter ved bytte av eID.
--
-- Kilde: bankid-oidc-norsk-eid-ferdigheten, som destillerer tolv
-- produksjonsfeil. De tre som styrer skjemaet her:
--   * unik indeks må matche ON CONFLICT-målet, ellers feiler upsert stille
--   * en svakere hash må aldri overskrive en sterkere
--   * hver autentisering koster penger og må logges

CREATE TABLE IF NOT EXISTS eid_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- bankid | buypass
  provider VARCHAR(30) NOT NULL,
  -- HMAC-SHA256 av fødselsnummeret. Aldri klartekst.
  ssn_hash TEXT,
  -- 'ssn' når hashen er laget av fødselsnummer, 'birthdate' ved fallback.
  -- Styrer regelen om at svakere aldri overskriver sterkere.
  ssn_hash_kind VARCHAR(20) NOT NULL DEFAULT 'ssn',
  -- Leverandørens egen subjekt-id. Lagres for sporing, brukes ALDRI som nøkkel.
  provider_sub TEXT,
  -- Navnet leverandøren oppga. Brukes til å vise «verifisert som …».
  verified_name TEXT,
  -- Fødselsår utledet av fnr. Nok til aldersgrenser uten å lagre datoen.
  birth_year INTEGER,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ON CONFLICT-målet i koden er (user_id, provider). Indeksen MÅ matche, ellers
-- svarer Postgres 42P10 og skrivingen feiler stille.
CREATE UNIQUE INDEX IF NOT EXISTS eid_identities_user_provider_idx
  ON eid_identities (user_id, provider);

-- Samme person skal finnes igjen på tvers av leverandør.
CREATE INDEX IF NOT EXISTS eid_identities_ssn_idx
  ON eid_identities (ssn_hash)
  WHERE ssn_hash IS NOT NULL;

-- Kortlevd rad per påbegynt verifisering. PKCE-verifier og nonce må ligge
-- serverside — de skal ikke overleve rundturen i URL-en.
CREATE TABLE IF NOT EXISTS eid_auth_states (
  state VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL,
  nonce VARCHAR(128) NOT NULL,
  code_verifier VARCHAR(255) NOT NULL,
  -- verify | sign — signering kommer i neste fase, kolonnen er med nå så
  -- flyten ikke må endres da.
  intent VARCHAR(20) NOT NULL DEFAULT 'verify',
  return_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  -- Engangsbruk: en state som er brukt kan ikke brukes igjen.
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS eid_auth_states_expiry_idx ON eid_auth_states (expires_at);

-- Hver autentisering faktureres (typisk 1–1,5 kr). Uten sporing oppdager man
-- ikke en koblingsløkke før fakturaen kommer.
CREATE TABLE IF NOT EXISTS eid_auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  provider VARCHAR(30) NOT NULL,
  intent VARCHAR(20) NOT NULL DEFAULT 'verify',
  -- started | completed | failed
  outcome VARCHAR(20) NOT NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eid_auth_events_user_idx ON eid_auth_events (user_id, created_at DESC);

-- Merket byråene ser. Selve identiteten ligger i eid_identities; talents
-- bærer bare flagget, så søk slipper en join.
ALTER TABLE talents ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE talents ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS talents_identity_verified_idx
  ON talents (identity_verified)
  WHERE identity_verified = TRUE;
