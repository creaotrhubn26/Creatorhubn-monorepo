-- =====================================================================
-- 242_cockpit_b2b_stack.sql
--
-- B2B-akkvisisjons-stack utvidelse til eksisterende Marketing Cockpit.
-- 9 features i én bolk:
--
--   1. LinkedIn Company auto-publish (utvider marketing_post_drafts)
--   2. B2B-funnel-panel (leser fra agency_leads — ingen ny tabell)
--   3. Lead-scoring MQL→SQL (utvider agency_leads med lead_score JSONB)
--   4. PR-distribusjon + journalist-DB (nye tabeller)
--   5. Webinar-organisator (nye tabeller)
--   6. Referral-program (ny tabell)
--   7. B2B-konkurrent pricing+features (utvider marketing_competitor_snapshots)
--   8. Email-nurture-automation (ny tabell)
--   9. Case study generator (ny tabell)
-- =====================================================================

BEGIN;

-- ── 1. LinkedIn Company auto-publish: utvid marketing_post_drafts ──
-- Tabellen finnes allerede (med platform-felt). Vi legger til
-- linkedin-spesifikke felter for company-page-publish.
ALTER TABLE marketing_post_drafts
  ADD COLUMN IF NOT EXISTS linkedin_company_urn VARCHAR(255),    -- f.eks. "urn:li:organization:12345"
  ADD COLUMN IF NOT EXISTS linkedin_post_urn VARCHAR(255),        -- etter publish
  ADD COLUMN IF NOT EXISTS linkedin_visibility VARCHAR(20)
    DEFAULT 'PUBLIC' CHECK (linkedin_visibility IN ('PUBLIC','CONNECTIONS','LOGGED_IN_MEMBERS'));

CREATE INDEX IF NOT EXISTS idx_post_drafts_linkedin_company
  ON marketing_post_drafts(linkedin_company_urn)
  WHERE linkedin_company_urn IS NOT NULL;

-- ── 3. Lead-scoring (MQL → SQL) ───────────────────────────────────
-- Utvid agency_leads med lead_score JSONB (eksisterer ikke fra før).
ALTER TABLE agency_leads
  ADD COLUMN IF NOT EXISTS lead_score JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS score_total INT,                       -- 0-100
  ADD COLUMN IF NOT EXISTS score_tier VARCHAR(20)
    CHECK (score_tier IN ('hot','warm','cold','disqualified')),
  ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scored_model VARCHAR(60);

CREATE INDEX IF NOT EXISTS idx_agency_leads_score_tier
  ON agency_leads(score_tier, score_total DESC NULLS LAST);

-- ── 4. PR-distribusjon: pressemeldinger + journalist-DB ───────────
CREATE TABLE IF NOT EXISTS pr_press_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Innhold
  headline VARCHAR(255) NOT NULL,
  subheadline TEXT,
  body_markdown TEXT NOT NULL,
  cta_url TEXT,

  -- Generering
  milestone VARCHAR(120),                  -- f.eks. "5 nye kunder", "1 mnd MRR > 30k"
  generated_with_model VARCHAR(60),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  -- Status
  status VARCHAR(40) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','approved','sent','archived')),
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Distribusjon
  embargo_until TIMESTAMPTZ,                -- "ikke publisér før X"
  distributed_to_journalist_count INT DEFAULT 0,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pr_press_releases_status
  ON pr_press_releases(status, created_at DESC);

CREATE TABLE IF NOT EXISTS pr_journalists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Person
  full_name VARCHAR(255) NOT NULL,
  outlet VARCHAR(255) NOT NULL,             -- f.eks. "Rushprint", "Filmweb", "NRK Kultur"
  role VARCHAR(120),                         -- f.eks. "Kulturredaktør", "Bransje-journalist"
  email VARCHAR(255),
  phone VARCHAR(50),
  twitter VARCHAR(120),
  linkedin VARCHAR(255),

  -- Bransje + interesse
  beat VARCHAR(120),                         -- "film/tv", "tech", "kreativ-bransje"
  interests JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Relasjons-tracking
  last_contacted_at TIMESTAMPTZ,
  last_response_at TIMESTAMPTZ,
  response_rate NUMERIC(4,2),                -- 0.0-1.0
  notes TEXT,

  status VARCHAR(40) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','snoozed','unsubscribed','archived')),
  added_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pr_journalists_unique_email UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_pr_journalists_outlet ON pr_journalists(outlet);
CREATE INDEX IF NOT EXISTS idx_pr_journalists_status ON pr_journalists(status);

-- Per release: hvilke journalister fikk det + status (mottatt/svart)
CREATE TABLE IF NOT EXISTS pr_release_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES pr_press_releases(id) ON DELETE CASCADE,
  journalist_id UUID NOT NULL REFERENCES pr_journalists(id) ON DELETE CASCADE,

  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  resulted_in_coverage BOOLEAN DEFAULT FALSE,
  coverage_url TEXT,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pr_release_dist_unique UNIQUE (release_id, journalist_id)
);

-- ── 5. Webinar-organisator ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webinars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Innhold
  slug VARCHAR(120) NOT NULL UNIQUE,         -- f.eks. "casting-roi-2026"
  title VARCHAR(255) NOT NULL,
  subtitle TEXT,
  description_markdown TEXT,
  hero_image_url TEXT,

  -- Tid + plattform
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  timezone VARCHAR(60) DEFAULT 'Europe/Oslo',
  zoom_join_url TEXT,
  zoom_meeting_id VARCHAR(60),
  recording_url TEXT,

  -- Status
  status VARCHAR(40) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('draft','scheduled','live','completed','cancelled')),
  capacity INT,                              -- valgfri øvre grense
  registration_open BOOLEAN NOT NULL DEFAULT TRUE,

  -- Host
  host_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webinars_scheduled_at ON webinars(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_webinars_status ON webinars(status);

CREATE TABLE IF NOT EXISTS webinar_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id UUID NOT NULL REFERENCES webinars(id) ON DELETE CASCADE,

  -- Registrant
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  agency VARCHAR(255),
  role VARCHAR(120),

  -- Attendance
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminder_24h_sent_at TIMESTAMPTZ,
  reminder_1h_sent_at TIMESTAMPTZ,
  attended BOOLEAN,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  attendance_duration_minutes INT,

  -- Source
  utm_source VARCHAR(120),
  utm_medium VARCHAR(120),
  utm_campaign VARCHAR(120),
  referrer TEXT,

  CONSTRAINT webinar_reg_unique UNIQUE (webinar_id, email)
);

CREATE INDEX IF NOT EXISTS idx_webinar_reg_webinar ON webinar_registrations(webinar_id);
CREATE INDEX IF NOT EXISTS idx_webinar_reg_email ON webinar_registrations(email);

-- ── 6. Referral-program ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Hvem refererte
  referrer_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  referrer_email VARCHAR(255),               -- fallback hvis ikke registrert bruker
  referrer_name VARCHAR(255),

  -- Hva fikk de
  referral_code VARCHAR(40) NOT NULL UNIQUE, -- generert kort kode
  reward_type VARCHAR(40) NOT NULL DEFAULT 'free_month'
    CHECK (reward_type IN ('free_month','discount_pct','credit_nok','tier_upgrade')),
  reward_value NUMERIC(10,2),                 -- 1.0 = 1 mnd, eller 25.0 = 25% off
  reward_currency VARCHAR(10),

  -- Referred entity
  referred_email VARCHAR(255),
  referred_agency_name VARCHAR(255),
  referred_lead_id UUID REFERENCES agency_leads(id) ON DELETE SET NULL,
  referred_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  -- Status
  status VARCHAR(40) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','signed_up','trial','customer','paid','disqualified','expired')),
  signed_up_at TIMESTAMPTZ,
  became_customer_at TIMESTAMPTZ,
  reward_granted_at TIMESTAMPTZ,
  reward_granted_to VARCHAR(40)
    CHECK (reward_granted_to IN ('referrer','referred','both')),

  -- Tracking
  click_count INT NOT NULL DEFAULT 0,
  last_click_at TIMESTAMPTZ,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_lead ON referrals(referred_lead_id);

-- ── 7. B2B-konkurrent pricing + features ──────────────────────────
-- Utvider marketing_competitor_snapshots (eksisterer fra før).
ALTER TABLE marketing_competitor_snapshots
  ADD COLUMN IF NOT EXISTS pricing_json JSONB,
  ADD COLUMN IF NOT EXISTS features_json JSONB,
  ADD COLUMN IF NOT EXISTS website_meta_json JSONB;

-- Tracker per-konkurrent featur-/pris-historikk slik at vi kan
-- vise diff over tid (f.eks. "Spotlight bumpet pris med 18 %")
CREATE INDEX IF NOT EXISTS idx_competitor_snapshots_pricing
  ON marketing_competitor_snapshots(competitor_id, snapshot_at DESC)
  WHERE pricing_json IS NOT NULL;

-- ── 8. Email-nurture-automation ──────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_lead_nurture_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES agency_leads(id) ON DELETE CASCADE,

  step INT NOT NULL,                         -- 1, 2, 3, 4, 5 i 5-dagers sekvens
  template_key VARCHAR(80) NOT NULL,         -- f.eks. "nurture_day1_value_pitch"
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  status VARCHAR(40) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','opened','clicked','bounced','skipped','disqualified')),

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT nurture_event_unique UNIQUE (lead_id, step)
);

CREATE INDEX IF NOT EXISTS idx_nurture_pending
  ON agency_lead_nurture_events(scheduled_at)
  WHERE status = 'pending';

-- ── 9. Case study generator ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Subject
  agency_name VARCHAR(255) NOT NULL,
  customer_lead_id UUID REFERENCES agency_leads(id) ON DELETE SET NULL,

  -- Innhold
  slug VARCHAR(160) UNIQUE,                  -- /case-studies/stella-casting
  headline VARCHAR(255) NOT NULL,
  challenge_markdown TEXT,
  solution_markdown TEXT,
  results_markdown TEXT,
  quote_text TEXT,
  quote_author VARCHAR(255),
  quote_role VARCHAR(120),

  -- Metrics fra data
  metric_set JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Eksempel: [{"label":"Casting-tid spart","value":"8t","delta_pct":52}]

  -- Generering
  generated_with_model VARCHAR(60),
  generated_at TIMESTAMPTZ,
  generated_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  -- Status
  status VARCHAR(40) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','review','approved','published','archived')),
  published_at TIMESTAMPTZ,
  public_url TEXT,
  hero_image_url TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_studies_status ON case_studies(status);
CREATE INDEX IF NOT EXISTS idx_case_studies_published_at
  ON case_studies(published_at DESC NULLS LAST);

-- ── updated_at-triggers (gjenbruker pattern fra andre tabeller) ──
CREATE OR REPLACE FUNCTION cockpit_b2b_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pr_press_releases_set_updated_at ON pr_press_releases;
CREATE TRIGGER trg_pr_press_releases_set_updated_at
  BEFORE UPDATE ON pr_press_releases FOR EACH ROW
  EXECUTE FUNCTION cockpit_b2b_set_updated_at();

DROP TRIGGER IF EXISTS trg_pr_journalists_set_updated_at ON pr_journalists;
CREATE TRIGGER trg_pr_journalists_set_updated_at
  BEFORE UPDATE ON pr_journalists FOR EACH ROW
  EXECUTE FUNCTION cockpit_b2b_set_updated_at();

DROP TRIGGER IF EXISTS trg_webinars_set_updated_at ON webinars;
CREATE TRIGGER trg_webinars_set_updated_at
  BEFORE UPDATE ON webinars FOR EACH ROW
  EXECUTE FUNCTION cockpit_b2b_set_updated_at();

DROP TRIGGER IF EXISTS trg_referrals_set_updated_at ON referrals;
CREATE TRIGGER trg_referrals_set_updated_at
  BEFORE UPDATE ON referrals FOR EACH ROW
  EXECUTE FUNCTION cockpit_b2b_set_updated_at();

DROP TRIGGER IF EXISTS trg_case_studies_set_updated_at ON case_studies;
CREATE TRIGGER trg_case_studies_set_updated_at
  BEFORE UPDATE ON case_studies FOR EACH ROW
  EXECUTE FUNCTION cockpit_b2b_set_updated_at();

COMMIT;
