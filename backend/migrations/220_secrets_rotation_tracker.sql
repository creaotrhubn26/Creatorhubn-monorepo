-- Secrets rotation tracker — spore hvor lenge siden hver hemmelig nøkkel
-- ble rotert, og varsle admin når 90-dagers vinduet nærmer seg.
--
-- Erstatter ikke en KMS — det forutsetter manuell rotasjon (admin går
-- til Stripe/Cloudflare/Render-dashboardet, lager ny nøkkel, lim inn
-- i Render env-vars, marker som rotert her).
--
-- Vi lagrer ALDRI selve nøkkelen her — kun metadata om når den sist
-- ble rotert.

CREATE TABLE IF NOT EXISTS secret_rotation_tracker (
  key_name TEXT PRIMARY KEY,
    -- Env-var-navnet: STRIPE_SECRET_KEY, CLOUDFLARE_R2_SECRET_ACCESS_KEY, etc.
  display_name TEXT NOT NULL,
    -- Menneske-lesbart navn for admin UI
  category TEXT NOT NULL,
    -- 'stripe' | 'cloudflare' | 'render' | 'google' | 'ai' | 'other'
  rotated_at TIMESTAMPTZ,
    -- NULL = aldri rotert via dette systemet
  rotated_by TEXT,
    -- email/userId av admin som markerte rotering
  rotation_interval_days INTEGER NOT NULL DEFAULT 90,
    -- Hvor ofte vi forventer rotering (90 = kvartalsvis)
  next_rotation_due TIMESTAMPTZ GENERATED ALWAYS AS (
    rotated_at + (rotation_interval_days || ' days')::interval
  ) STORED,
  notes TEXT,
    -- Fri tekst — f.eks. "Roteres sammen med CLOUDFLARE_R2_ACCESS_KEY_ID"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS secret_rotation_due_idx
  ON secret_rotation_tracker (next_rotation_due ASC)
  WHERE rotated_at IS NOT NULL;

-- Audit-logg over hver rotering
CREATE TABLE IF NOT EXISTS secret_rotation_history (
  id BIGSERIAL PRIMARY KEY,
  key_name TEXT NOT NULL,
  rotated_at TIMESTAMPTZ NOT NULL,
  rotated_by TEXT NOT NULL,
  previous_rotated_at TIMESTAMPTZ,
  days_since_previous INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS secret_rotation_history_key_idx
  ON secret_rotation_history (key_name, rotated_at DESC);

-- Seed kjente nøkler så admin ser dem umiddelbart.
-- Setter rotated_at=NULL slik at de markeres som "trenger rotering" i UI.
INSERT INTO secret_rotation_tracker (key_name, display_name, category, rotation_interval_days, notes)
VALUES
  ('STRIPE_SECRET_KEY', 'Stripe — primær API-nøkkel', 'stripe', 90, 'Brukes av webhook-handler + subscription-ops.'),
  ('STRIPE_WEBHOOK_SECRET', 'Stripe — webhook-signering', 'stripe', 180, 'Lavere risiko ved roterng (kun signaturverifisering).'),
  ('STRIPE_WEBHOOK_SECRET_POST_AGENT', 'Stripe — Post Agent webhook', 'stripe', 180, NULL),
  ('CLOUDFLARE_R2_ACCESS_KEY_ID', 'Cloudflare R2 — access key', 'cloudflare', 90, 'Roteres sammen med secret_access_key.'),
  ('CLOUDFLARE_R2_SECRET_ACCESS_KEY', 'Cloudflare R2 — secret key', 'cloudflare', 90, 'Roteres sammen med access_key_id.'),
  ('CLOUDFLARE_STREAM_API_TOKEN', 'Cloudflare Stream — API token', 'cloudflare', 90, NULL),
  ('CLOUDFLARE_STREAM_WEBHOOK_SECRET', 'Cloudflare Stream — webhook-signering', 'cloudflare', 180, NULL),
  ('SESSION_SECRET', 'Session-cookie-signering', 'other', 365, 'Bytte triggrer logout for alle. Plant rolig.'),
  ('JWT_SECRET', 'JWT-signering', 'other', 180, NULL),
  ('ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY', 'Google-token kryptering', 'google', 365, 'Bytte = re-krypter alle lagrede Google-tokens.'),
  ('OPENAI_API_KEY', 'OpenAI — API-nøkkel', 'ai', 90, NULL),
  ('ANTHROPIC_API_KEY', 'Anthropic — API-nøkkel', 'ai', 90, NULL)
ON CONFLICT (key_name) DO NOTHING;
