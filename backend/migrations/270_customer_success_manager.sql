-- =====================================================================
-- 270_customer_success_manager.sql
--
-- Wave M2 — Customer Success Manager utvidelse til Marketing Cockpit.
--
-- 3 tabeller:
--   1. customer_health_snapshots — daglig snapshot per kunde:
--      score 0-100 + breakdown (login/feature/billing/support)
--   2. customer_interactions — tidslinje av møter/mail/support/notes
--   3. customer_renewal_pipeline — kommende fornyelser (90 dager fram)
--
-- "Customer" = users der is_active=TRUE OG (har casting_projects OG/ELLER
-- agency_leads.status='customer' lenket via email).
-- =====================================================================

BEGIN;

-- ── 1. customer_health_snapshots ────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Beregnet hver natt via cron. Den nyeste raden brukes som "current"
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Score: 0-100, høyere = sunnere
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  health_tier TEXT NOT NULL CHECK (health_tier IN ('green', 'yellow', 'red')),

  -- Subscore-breakdown (gir UI insikt i hva som drar ned)
  login_score INTEGER NOT NULL DEFAULT 0,          -- 0-25, basert på login-frekvens
  feature_score INTEGER NOT NULL DEFAULT 0,        -- 0-25, basert på adopsjon
  billing_score INTEGER NOT NULL DEFAULT 0,        -- 0-25, basert på Stripe-status
  engagement_score INTEGER NOT NULL DEFAULT 0,     -- 0-25, basert på prosjekt-aktivitet

  -- Raw signaler så vi kan reseed om logikken endrer seg
  days_since_login INTEGER,
  active_projects_30d INTEGER,
  features_used_30d INTEGER,
  stripe_status TEXT,
  days_to_renewal INTEGER,

  -- AI-genererte forslag (Claude — for ledelses-dashboard)
  ai_summary TEXT,
  ai_next_action TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_health_user_time
  ON customer_health_snapshots(user_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_health_tier
  ON customer_health_snapshots(health_tier, computed_at DESC);

-- ── 2. customer_interactions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Hvem på vårt team interaksjonen er logget av
  logged_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'email_in', 'email_out', 'call', 'meeting', 'support_ticket',
    'note', 'qbr', 'churn_signal', 'expansion_signal', 'renewal_won', 'renewal_lost'
  )),

  -- Innhold
  subject TEXT,
  body TEXT,
  -- Strukturerte felter
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  follow_up_at TIMESTAMPTZ,                          -- Når neste handling skal skje
  follow_up_completed BOOLEAN DEFAULT FALSE,

  -- For QBR-er + meetings
  attendees JSONB DEFAULT '[]'::jsonb,
  meeting_url TEXT,

  -- For expansion-/churn-signaler
  expansion_value_nok NUMERIC(10,2),               -- Forventet ARPU-uplift
  churn_risk_level TEXT CHECK (churn_risk_level IN ('low', 'medium', 'high')),

  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_interactions_user_time
  ON customer_interactions(user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_interactions_followup
  ON customer_interactions(follow_up_at, follow_up_completed)
  WHERE follow_up_at IS NOT NULL AND follow_up_completed = FALSE;

-- ── 3. customer_renewal_pipeline ────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_renewal_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Subscription-info (denormalisert fra Stripe for raskere visning)
  stripe_subscription_id TEXT,
  current_plan_name TEXT,
  current_arpu_nok NUMERIC(10,2),

  -- Renewal-dato (fra Stripe current_period_end)
  renewal_at TIMESTAMPTZ NOT NULL,

  -- CSM-handling
  renewal_status TEXT NOT NULL DEFAULT 'pending' CHECK (renewal_status IN (
    'pending', 'at_risk', 'engaged', 'committed', 'won', 'lost', 'churned'
  )),
  expansion_opportunity_nok NUMERIC(10,2),         -- Forventet uplift
  outreach_owner_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  last_outreach_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, renewal_at)
);

CREATE INDEX IF NOT EXISTS idx_renewal_pipeline_upcoming
  ON customer_renewal_pipeline(renewal_at)
  WHERE renewal_status NOT IN ('won', 'lost', 'churned');

CREATE INDEX IF NOT EXISTS idx_renewal_pipeline_owner
  ON customer_renewal_pipeline(outreach_owner_user_id, renewal_at);

COMMIT;
