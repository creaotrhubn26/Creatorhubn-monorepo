-- Task #114: integrations-katalog + secret_rotation_tracker for admin-integrations-extras.
--
-- VIKTIG: api_keys, webhooks og oauth_clients eksisterer allerede i prod-DBen
-- med sine egne kolonne-sett. Vi skriver derfor CREATE TABLE IF NOT EXISTS slik
-- at migrasjonen er trygg å kjøre på fersk-DB (lokal dev, ny env, tester),
-- mens den i prod blir en no-op.
--
-- Routes-fila (admin-integrations-extras-routes.ts) bruker columnsOf() til å
-- detektere hvilke kolonner som faktisk finnes, så den fungerer både mot
-- legacy-skjemaet i prod og det forenklede skjemaet under.
--
-- secret_rotation_tracker eksisterer ikke i prod ennå — denne migrasjonen
-- garanterer at både tabellen og seed-data finnes.

-- ── api_keys ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_prefix TEXT NOT NULL,
    -- F.eks. "sk_creator_abc" (trygt å vise i UI)
  key_hash TEXT NOT NULL,
    -- bcrypt/argon-hash (aldri returner i respons)
  label TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  created_by_user_id UUID,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indekser opprettes kun hvis kolonnen finnes (defensiv mot legacy-skjema).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='api_keys' AND column_name='is_active') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS api_keys_is_active_idx ON api_keys (is_active)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='api_keys' AND column_name='created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS api_keys_created_at_idx ON api_keys (created_at DESC)';
  END IF;
END
$$;

-- ── webhooks ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
    -- ['payment.completed', 'user.signup', ...]
  secret_hash TEXT,
    -- For HMAC signing — aldri returner i respons
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_delivered_at TIMESTAMPTZ,
  last_status_code INTEGER,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='webhooks' AND column_name='is_active') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS webhooks_is_active_idx ON webhooks (is_active)';
  END IF;
END
$$;

-- ── oauth_clients ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  redirect_uris TEXT[] NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='oauth_clients' AND column_name='is_active') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS oauth_clients_is_active_idx ON oauth_clients (is_active)';
  END IF;
END
$$;

-- ── secret_rotation_tracker ──────────────────────────────────────────────
-- Tidligere migrasjon 220_secrets_rotation_tracker.sql ble laget men aldri
-- applisert i prod (mangler i _migrations_applied). Vi re-skaper schemaet
-- defensivt her slik at admin-integrations-extras kan koble lastRotatedAt
-- mot env-secrets-listen uten å bryte.
CREATE TABLE IF NOT EXISTS secret_rotation_tracker (
  key_name TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
    -- 'stripe' | 'cloudflare' | 'google' | 'meta' | 'ai' | 'render' | 'other'
  rotated_at TIMESTAMPTZ,
  rotated_by TEXT,
  rotation_interval_days INTEGER NOT NULL DEFAULT 90,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS secret_rotation_rotated_idx
  ON secret_rotation_tracker (rotated_at ASC NULLS FIRST);

-- Seed kjente nøkler så admin-UI viser dem umiddelbart.
INSERT INTO secret_rotation_tracker (key_name, display_name, category, rotation_interval_days, notes)
VALUES
  ('STRIPE_SECRET_KEY', 'Stripe — primær API-nøkkel', 'stripe', 90, 'Brukes av webhook-handler + subscription-ops.'),
  ('STRIPE_WEBHOOK_SECRET', 'Stripe — webhook-signering', 'stripe', 180, NULL),
  ('CLOUDFLARE_R2_ACCESS_KEY_ID', 'Cloudflare R2 — access key', 'cloudflare', 90, NULL),
  ('CLOUDFLARE_R2_SECRET_ACCESS_KEY', 'Cloudflare R2 — secret key', 'cloudflare', 90, NULL),
  ('CLOUDFLARE_STREAM_API_TOKEN', 'Cloudflare Stream — API token', 'cloudflare', 90, NULL),
  ('GOOGLE_ADS_DEVELOPER_TOKEN', 'Google Ads — developer token', 'google', 365, 'Basic Access søknad innsendt.'),
  ('META_APP_SECRET', 'Meta — app secret', 'meta', 180, NULL),
  ('OPENAI_API_KEY', 'OpenAI — API-nøkkel', 'ai', 90, NULL),
  ('ANTHROPIC_API_KEY', 'Anthropic — API-nøkkel', 'ai', 90, NULL),
  ('CLAUDE_API_KEY', 'Claude — API-nøkkel (legacy alias)', 'ai', 90, NULL)
ON CONFLICT (key_name) DO NOTHING;
