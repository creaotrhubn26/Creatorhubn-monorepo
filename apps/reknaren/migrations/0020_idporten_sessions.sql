-- 0020_idporten_sessions.sql
--
-- ID-porten OIDC for mva-melding (validering/innsending krever pålogget bruker).
--   idporten_login_state: kortlevd PKCE/state mellom /login og /callback.
--   idporten_sessions:    lagret access-/refresh-token per org etter innlogging.
-- Tokenene er bærer-legitimasjon; behandles som hemmeligheter (samme tillitsgrense
-- som resten av DB-en). Kun ett aktivt token per org.

CREATE TABLE idporten_login_state (
  state TEXT PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code_verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE idporten_sessions (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scope TEXT,
  subject TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
