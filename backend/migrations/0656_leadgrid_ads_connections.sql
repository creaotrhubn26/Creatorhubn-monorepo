-- Leadgrids egne annonsekonto-koblinger, per prosjekt.
--
-- Kapabiliteten finnes allerede og er ekte: client-google-suite.ts kan
-- opprette GTM-containere, importere tagger og triggere, provisjonere
-- GA4-properties og verifisere Search Console. client-meta-suite.ts og
-- client-tiktok-suite.ts gjør tilsvarende for sine plattformer.
--
-- Det som mangler er ikke integrasjonen. Det er BINDINGEN: hver eneste av
-- disse funksjonene tar producerUserId og leser tokenet fra
-- role_room_ads_oauth_connections (user_id, platform). Det er byråets
-- kobling. Det finnes ingen vei fra et Leadgrid-prosjekt til en Google-,
-- Meta- eller TikTok-konto.
--
-- Hvorfor en egen tabell og ikke en peker inn i Role Rooms:
--   Role Rooms tabell er nøklet på user_id uten organization_id. Å la
--   Leadgrid låne en rad der ville bundet kundens annonsetilgang til en
--   byråansatt sin brukerkonto — feil eierskap, og umulig å skille ad hvis
--   kunden forlater byrået.
--
-- Hvorfor SAMME Google-app likevel:
--   tagmanager.* og analytics.edit er sensitive scopes. En ny client_id må
--   gjennom Googles appverifisering på nytt, som tar uker. Ved å beholde
--   GOOGLE_ADS_OAUTH_CLIENT_ID og bare legge til en Leadgrid-redirect-URI,
--   arver vi godkjenningen som allerede finnes. Tabellen er vår; appen er
--   den samme.

CREATE TABLE IF NOT EXISTS leadgrid_ads_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        TEXT NOT NULL,

  platform          VARCHAR(12) NOT NULL
    CHECK (platform IN ('google', 'meta', 'tiktok', 'linkedin')),

  -- Kryptert med google-oauth-shared.ts. Aldri klartekst på disk.
  access_token_encrypted  TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at  TIMESTAMPTZ,
  scopes            TEXT[] NOT NULL DEFAULT '{}',

  -- Kontoen hos plattformen, slik plattformen navngir den:
  --   google  customerId (Ads), eller tomt til kunden velger konto
  --   meta    annonsekonto-id
  --   tiktok  advertiser_id
  account_ref       VARCHAR(120),
  account_label     VARCHAR(200),

  connection_state  VARCHAR(20) NOT NULL DEFAULT 'connected'
    CHECK (connection_state IN ('connected', 'needs_reauth', 'revoked', 'error')),
  last_error        TEXT,
  last_refreshed_at TIMESTAMPTZ,
  last_used_at      TIMESTAMPTZ,

  -- Hvem som koblet til. Slettes brukeren, står koblingen igjen: den
  -- tilhører prosjektet, ikke personen. Det er hele poenget.
  connected_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at        TIMESTAMPTZ,

  CONSTRAINT leadgrid_ads_connections_project_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- Én aktiv kobling per plattform per prosjekt. To ville betydd at et kall
-- kunne truffet ulike kontoer avhengig av radrekkefølge.
CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_ads_connections_active
  ON leadgrid_ads_connections (organization_id, project_id, platform)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_ads_connections_state
  ON leadgrid_ads_connections (connection_state)
  WHERE revoked_at IS NULL AND connection_state <> 'connected';

-- ── OAuth-state ──────────────────────────────────────────────────────────
-- Hvilket prosjekt en påbegynt autorisasjon gjelder. Uten dette måtte
-- prosjekt-id-en ligget i state-parameteren og vært til å tukle med:
-- da kunne noen koblet sin egen Google-konto til et annet prosjekt.
CREATE TABLE IF NOT EXISTS leadgrid_ads_oauth_states (
  state             VARCHAR(80) PRIMARY KEY,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        TEXT NOT NULL,
  platform          VARCHAR(12) NOT NULL,
  started_by_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri      TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Kortlevd med vilje. En state som ligger igjen i timevis er en åpen dør.
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  consumed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_ads_oauth_states_opprydding
  ON leadgrid_ads_oauth_states (expires_at)
  WHERE consumed_at IS NULL;
