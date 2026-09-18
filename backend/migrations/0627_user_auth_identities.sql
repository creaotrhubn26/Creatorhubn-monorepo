-- Ekstern innloggingsidentitet (LinkedIn i første omgang).
--
-- users har ingen provider-id-kolonne (google_id/auth_provider ble fjernet i
-- 0001); Google-innlogging matcher kun på e-post. LinkedIn-innlogging må kunne
-- gjenkjenne en bruker selv om e-posten hos LinkedIn endres, og må kunne
-- avvise at én LinkedIn-konto knyttes til to brukere. Én rad per
-- (provider, subject). Rå userinfo lagres i profile for feilsøking.

CREATE TABLE IF NOT EXISTS user_auth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  email TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS idx_user_auth_identities_user
  ON user_auth_identities (user_id);
