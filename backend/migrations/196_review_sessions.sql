-- Client Review Portal — signed-token sessions for at klienter kan
-- se cuts, kommentere, og approve/reject uten å logge inn.
--
-- Token er signert og lagres i tabellen for verifisering. Sessions
-- har expires_at (default 30 dager) så gamle review-links ikke kan
-- gjenbrukes etter at prosjektet er ferdig.

CREATE TABLE IF NOT EXISTS role_room_review_sessions (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  project_id text NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  -- Signed token — base64-encoded random + HMAC-signed på server-side.
  -- Klient bruker denne i URL: /review/:token
  token text NOT NULL UNIQUE,
  -- Hvilken agent som lagde session-en
  agent_kind text,
  -- Bjarne setter dette så klient ser "Velkommen [Title]" når de åpner
  session_title text,
  -- Klient-info (Bjarne fyller inn så vi vet hvem som reviewer)
  client_name text,
  client_email text,
  -- Settings: hva som er synlig i review
  -- { showCuts, showBroll, showMusic, showLowerThirds, showCaptions,
  --   allowReject, allowApprove, allowComments }
  visibility_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Status: draft (kun Bjarne ser) → active (klient kan reviewe) →
  -- completed (klient har godkjent alle/avsluttet) → expired
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'expired')),
  -- Når session utløper og tokenet ikke lenger fungerer
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  -- Når klient sist åpnet review-siden
  last_viewed_at timestamptz,
  -- Antall ganger session-en har blitt åpnet av klient
  view_count int NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_sessions_project
  ON role_room_review_sessions(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_sessions_token
  ON role_room_review_sessions(token);

COMMENT ON TABLE role_room_review_sessions IS
  'Klient-review-sessions med signed-token-auth. Klient åpner '
  '/review/:token i nettleseren, ser cuts/B-roll/music/etc. avhengig '
  'av visibility_settings, og kan kommentere + approve/reject.';
