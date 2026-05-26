-- Plattform-kostnader for full P&L i Admin Room
--
-- Lagrer faste månedlige kostnader Daniel betaler for verktøy som
-- CreatorHub/Role Room/Post Agent/NextRole kjører på:
--   - Claude Pro Max-abonnement (AI utenom API-call-kost)
--   - Vercel Pro / Enterprise (hosting/CDN)
--   - Render (backend-hosting)
--   - Cloudflare (DNS/WAF)
--   - Database-hosting
--   - Andre SaaS-verktøy som er nødvendig for drift
--
-- Allokering:
--   - 'role_room_only'  : 100% mot Role Room-margin
--   - 'total_platform'  : fordelt på alle produkter basert på
--                          role_room_share_pct (0..100) — admin setter selv
--   - 'per_active_user' : multipliseres med antall aktive RR-brukere
--                          (sjelden brukt — mest for SaaS som faktureres seat-basert)

CREATE TABLE IF NOT EXISTS platform_fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(120) NOT NULL,
  vendor VARCHAR(80),
  category VARCHAR(40) NOT NULL DEFAULT 'other',
  amount_usd_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount_native_monthly NUMERIC(12, 2),
  native_currency VARCHAR(10),
  allocation_method VARCHAR(30) NOT NULL DEFAULT 'total_platform',
  role_room_share_pct NUMERIC(5, 2) NOT NULL DEFAULT 25.0,
  billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_on DATE,
  ends_on DATE,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (category IN ('ai', 'hosting', 'cdn', 'storage', 'database', 'devtool', 'monitoring', 'email', 'other')),
  CHECK (allocation_method IN ('role_room_only', 'total_platform', 'per_active_user')),
  CHECK (billing_interval IN ('monthly', 'yearly', 'one_time')),
  CHECK (role_room_share_pct >= 0 AND role_room_share_pct <= 100)
);

CREATE INDEX IF NOT EXISTS idx_platform_fixed_costs_user
  ON platform_fixed_costs (user_id, active);

CREATE INDEX IF NOT EXISTS idx_platform_fixed_costs_category
  ON platform_fixed_costs (category, active);
