-- 0492: make active Leadgrid data flows deploy-safe.
--
-- Several older route modules contain CREATE TABLE/ALTER TABLE guards so
-- installations could self-heal on first request. That is not a dependable
-- deployment contract: a read request may require DDL privileges and two
-- instances can discover the schema at the same time. This migration makes
-- the persisted contracts explicit. The route guards remain temporarily as
-- backward-compatible no-ops.

CREATE TABLE IF NOT EXISTS leadgrid_doffin_watches (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  query JSONB NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_ids JSONB NOT NULL DEFAULT '[]',
  last_checked_at TIMESTAMPTZ,
  new_hits_count INT NOT NULL DEFAULT 0
);
ALTER TABLE leadgrid_doffin_watches
  ADD COLUMN IF NOT EXISTS seen_ids JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS new_hits_count INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_doffin_watches_org
  ON leadgrid_doffin_watches (organization_id);

CREATE TABLE IF NOT EXISTS leadgrid_anbud_pipeline (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  doffin_id TEXT NOT NULL,
  tittel TEXT NOT NULL,
  oppdragsgiver TEXT NOT NULL DEFAULT '',
  orgnr TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  frist TIMESTAMPTZ,
  verdi NUMERIC,
  status TEXT NOT NULL DEFAULT 'vurderer',
  assigned_user_id TEXT,
  notat TEXT NOT NULL DEFAULT '',
  varslet_7d BOOLEAN NOT NULL DEFAULT FALSE,
  varslet_1d BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  adresse TEXT,
  tapt_aarsak TEXT,
  UNIQUE (organization_id, doffin_id)
);
ALTER TABLE leadgrid_anbud_pipeline
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS adresse TEXT,
  ADD COLUMN IF NOT EXISTS tapt_aarsak TEXT;
CREATE INDEX IF NOT EXISTS idx_anbud_pipeline_org
  ON leadgrid_anbud_pipeline (organization_id, status);

CREATE TABLE IF NOT EXISTS leadgrid_canvas_notater (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tittel TEXT NOT NULL DEFAULT '',
  kategori TEXT NOT NULL DEFAULT 'mote',
  selskap TEXT,
  lead_id TEXT,
  drawing_base64 TEXT NOT NULL DEFAULT '',
  delt BOOLEAN NOT NULL DEFAULT false,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  stempler TEXT NOT NULL DEFAULT '[]',
  tekstbokser TEXT NOT NULL DEFAULT '[]',
  figurer TEXT NOT NULL DEFAULT '[]',
  papir TEXT NOT NULL DEFAULT 'blank',
  noder TEXT NOT NULL DEFAULT '[]',
  sider INT NOT NULL DEFAULT 1,
  objekter TEXT NOT NULL DEFAULT '[]',
  sokbar_tekst TEXT NOT NULL DEFAULT '',
  dokumenter TEXT NOT NULL DEFAULT '[]',
  slettet_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE leadgrid_canvas_notater
  ADD COLUMN IF NOT EXISTS delt BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS stempler TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS tekstbokser TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS figurer TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS papir TEXT NOT NULL DEFAULT 'blank',
  ADD COLUMN IF NOT EXISTS noder TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sider INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS objekter TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sokbar_tekst TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dokumenter TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS slettet_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_leadgrid_canvas_bruker
  ON leadgrid_canvas_notater (organization_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS leadgrid_canvas_versjoner (
  id UUID PRIMARY KEY,
  notat_id UUID NOT NULL,
  kategori TEXT NOT NULL DEFAULT 'mote',
  drawing_base64 TEXT NOT NULL DEFAULT '',
  objekter TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_canvas_versjoner_notat
  ON leadgrid_canvas_versjoner (notat_id, created_at DESC);

CREATE TABLE IF NOT EXISTS leadgrid_canvas_dokumenter (
  id TEXT PRIMARY KEY,
  notat_id UUID NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  navn TEXT NOT NULL DEFAULT '',
  base64 TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_canvas_dokumenter_notat
  ON leadgrid_canvas_dokumenter (notat_id);

CREATE TABLE IF NOT EXISTS leadgrid_canvas_bibliotek (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  navn TEXT NOT NULL DEFAULT '',
  innhold TEXT NOT NULL DEFAULT '{}',
  delt BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_canvas_bibliotek_org
  ON leadgrid_canvas_bibliotek (organization_id);

CREATE TABLE IF NOT EXISTS leadgrid_mote_logg (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  selskap TEXT NOT NULL,
  orgnr TEXT,
  lead_id UUID REFERENCES crm_customers(id) ON DELETE SET NULL,
  meeting_at TIMESTAMPTZ,
  request_id UUID,
  resultat JSONB,
  notat TEXT NOT NULL DEFAULT '',
  lofter JSONB NOT NULL DEFAULT '[]',
  oppgaver JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE leadgrid_mote_logg
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES crm_customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meeting_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS resultat JSONB;
CREATE INDEX IF NOT EXISTS idx_mote_logg_selskap
  ON leadgrid_mote_logg (organization_id, lower(selskap), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mote_logg_meeting
  ON leadgrid_mote_logg (organization_id, lead_id, meeting_at DESC)
  WHERE lead_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mote_logg_request
  ON leadgrid_mote_logg (organization_id, request_id)
  WHERE request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS leadgrid_oppgaver (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  selskap TEXT NOT NULL,
  lead_id TEXT,
  tittel TEXT NOT NULL,
  frist TEXT,
  kilde TEXT NOT NULL DEFAULT 'mote_etterarbeid',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  done_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_leadgrid_oppgaver_bruker
  ON leadgrid_oppgaver (organization_id, user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS leadgrid_mote_maal (
  organization_id TEXT NOT NULL,
  selskap_key TEXT NOT NULL,
  selskap TEXT NOT NULL,
  maal TEXT NOT NULL DEFAULT '',
  behov JSONB NOT NULL DEFAULT '[]',
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, selskap_key)
);

CREATE TABLE IF NOT EXISTS leadgrid_oversikt_policy (
  organization_id TEXT NOT NULL,
  malgruppe TEXT NOT NULL,
  skjulte_kort JSONB NOT NULL DEFAULT '[]',
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, malgruppe)
);

CREATE TABLE IF NOT EXISTS leadgrid_canvas_policy (
  organization_id TEXT NOT NULL,
  malgruppe TEXT NOT NULL,
  skjulte_funksjoner JSONB NOT NULL DEFAULT '[]',
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, malgruppe)
);

CREATE TABLE IF NOT EXISTS leadgrid_rute_planer (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  assigned_user_id TEXT,
  navn TEXT NOT NULL DEFAULT '',
  stopp JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'tildelt',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rute_planer_assigned
  ON leadgrid_rute_planer (assigned_user_id, status, created_at DESC);

-- Public Leadgrid acquisition/review flows also used lazy DDL. They are not
-- tenant business records, but still need deterministic deploy-time schema.
CREATE TABLE IF NOT EXISTS leadgrid_app_waitlist (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ
);
ALTER TABLE leadgrid_app_waitlist
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS leadgrid_demo_requests (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  preferred TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  contacted BOOLEAN NOT NULL DEFAULT false,
  org_number TEXT NOT NULL DEFAULT '',
  nace_code TEXT,
  nace_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE leadgrid_demo_requests
  ADD COLUMN IF NOT EXISTS org_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nace_code TEXT,
  ADD COLUMN IF NOT EXISTS nace_description TEXT;

CREATE TABLE IF NOT EXISTS leadgrid_testimonials (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL,
  rating INT NOT NULL DEFAULT 5,
  source TEXT NOT NULL DEFAULT 'app',
  approved BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  submitter_org TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leadgrid_signup_leads (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'app_login',
  contacted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lg_signup_email
  ON leadgrid_signup_leads (lower(email));
