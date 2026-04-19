-- 0055_role_room_marketing_plan_posts.sql
-- Slice 2 av Marketing Plan Engine — den konkrete 30-dagers planen.
-- Hver rad er ett innholdsstykke med alle feltene fotografen trenger
-- for å gå fra idé til ekte post: hook, format, script, CTA, primær
-- kanal, cross-post-regler og KPI-mål.
--
-- Tabellen er frittstående fra role_room_feed_plans.posts — en
-- marketing-plan-post blir til en feed_plan_post når fotografen
-- eksplisitt "aksepterer" den (Slice 2.5). Inntil da lever forslaget
-- her uten å forurense feed-planneren.

CREATE TABLE IF NOT EXISTS role_room_marketing_plan_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES role_room_marketing_plans(id) ON DELETE CASCADE,
  pillar_id UUID REFERENCES role_room_marketing_plan_pillars(id) ON DELETE SET NULL,

  -- Rekkefølge i planen. sort_order er den interne listen; day_offset
  -- er relativt til plan.start_date (NULL før aktivering).
  sort_order INT NOT NULL DEFAULT 0,
  day_offset INT,

  -- Innhold
  hook TEXT NOT NULL,              -- 1-2 linjer — åpningssetningen i reels/caption
  format TEXT NOT NULL              -- primært leveringsformat
    CHECK (format IN ('reel','carousel','image','story','tiktok','linkedin_post','youtube_short')),
  script TEXT,                      -- idé / beat-sheet / reel-story
  caption_draft TEXT,               -- første caption-utkast (fotografen redigerer før publisering)
  call_to_action TEXT,              -- "Book en befaring", "Kommenter med X", "Sveip for…"

  -- Distribusjon
  primary_platform TEXT             -- 'instagram' / 'tiktok' / 'linkedin' etc.
    CHECK (primary_platform IN ('instagram','tiktok','linkedin','youtube','facebook') OR primary_platform IS NULL),
  -- Format: [{ platform, delayDays, adaptationNote }]
  cross_post_plan JSONB,

  -- Mål
  goal_kpi JSONB,                   -- { metric, target, per }

  -- Livssyklus
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','scheduled','published','skipped')),
  feed_plan_post_id TEXT,           -- satt når fotografen kobler forslaget til feed-planneren
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_marketing_plan_posts_plan_idx
  ON role_room_marketing_plan_posts (plan_id, sort_order);

CREATE INDEX IF NOT EXISTS role_room_marketing_plan_posts_pillar_idx
  ON role_room_marketing_plan_posts (pillar_id)
  WHERE pillar_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS role_room_marketing_plan_posts_schedule_idx
  ON role_room_marketing_plan_posts (plan_id, day_offset)
  WHERE day_offset IS NOT NULL;

CREATE INDEX IF NOT EXISTS role_room_marketing_plan_posts_status_idx
  ON role_room_marketing_plan_posts (plan_id, status);

COMMENT ON TABLE role_room_marketing_plan_posts IS
  'Konkrete post-forslag for en markedsplan. Status proposed → scheduled (koblet til feed-planner) → published. Cross-post-plan er IG primary → TikTok +2d → LinkedIn +5d-type regler.';
