-- Tier-1 industry-target-CRM for The Role Room content/engagement-strategi
--
-- Operativsystem bak prinsippet i TheRoleRoom-Content-Marketing-Plan.md:
-- "Post for the 500 people in the Norwegian film industry, even when only
-- 12 of them are watching today."
--
-- Hver target er en person Daniel ønsker mental availability hos:
-- casting directors, produsenter, regissører, NSF/NFI-staff, presse,
-- forbund. Tier-feltet styrer engagement-prioritering (T1 = svar samme
-- dag, T2 = ukentlig touchpoint, T3 = månedlig).

CREATE TABLE IF NOT EXISTS role_room_industry_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  role_title VARCHAR(200),
  company VARCHAR(200),
  segment VARCHAR(40) NOT NULL DEFAULT 'producer',
  tier VARCHAR(4) NOT NULL DEFAULT 'T2',
  status VARCHAR(30) NOT NULL DEFAULT 'cold',
  linkedin_url VARCHAR(500),
  instagram_handle VARCHAR(100),
  email VARCHAR(320),
  phone VARCHAR(40),
  city VARCHAR(120),
  notes TEXT,
  last_engaged_at TIMESTAMP WITH TIME ZONE,
  last_engaged_kind VARCHAR(30),
  next_action TEXT,
  next_action_due DATE,
  engagement_count INTEGER NOT NULL DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_room_industry_targets_user
  ON role_room_industry_targets (user_id);

CREATE INDEX IF NOT EXISTS idx_role_room_industry_targets_tier
  ON role_room_industry_targets (user_id, tier);

CREATE INDEX IF NOT EXISTS idx_role_room_industry_targets_segment
  ON role_room_industry_targets (user_id, segment);

CREATE INDEX IF NOT EXISTS idx_role_room_industry_targets_last_engaged
  ON role_room_industry_targets (user_id, last_engaged_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_role_room_industry_targets_next_action_due
  ON role_room_industry_targets (user_id, next_action_due ASC NULLS LAST);

-- Engagement-log per target — én rad per kommentar/DM/møte slik at
-- "Comments from Tier-1 targets"-metric (planens side 26, mål 5→25/mnd)
-- kan beregnes pålitelig over tid.
CREATE TABLE IF NOT EXISTS role_room_industry_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES role_room_industry_targets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kind VARCHAR(30) NOT NULL,
  direction VARCHAR(10) NOT NULL DEFAULT 'outbound',
  channel VARCHAR(20),
  summary TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_room_industry_engagements_target
  ON role_room_industry_engagements (target_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_role_room_industry_engagements_user_kind
  ON role_room_industry_engagements (user_id, kind, occurred_at DESC);
