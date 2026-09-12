-- Migrasjon 253: social_media_posts + marketing_automation_workflows
--
-- Backer admin marketing-fanen: social media-posts (draft/scheduled/posted)
-- og marketing-automation-workflows (multi-step triggers).
--
-- Skjemaet er bevisst smalt nok til at vi kan utvide trygt (metadata JSONB
-- + steps JSONB lar oss legge til actions uten migrasjon).
--
-- NB: en eldre social_media_posts-tabell finnes allerede (drizzle-schema
-- med varchar id, post_content, user_id, engagement_metrics …). Vi
-- ALTER-er den til å eksponere de feltene admin-fanen trenger uten å
-- bryte de eksisterende kolonnene. Marketing-workflows-tabellen er ny.

-- ───────── social_media_posts (utvidelse av eksisterende tabell) ─────────

CREATE TABLE IF NOT EXISTS social_media_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL, -- 'instagram' | 'linkedin' | 'tiktok' | 'twitter' | 'facebook' | 'youtube'
  external_post_id TEXT,
  caption TEXT,
  media_urls TEXT[] DEFAULT '{}',
  hashtags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'scheduled' | 'posted' | 'failed' | 'deleted'
  scheduled_for TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  impressions INTEGER NOT NULL DEFAULT 0,
  engagements INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  campaign_id UUID,
  author_user_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns idempotent for tabeller som ble laget av tidligere
-- drizzle-schema (post_content/user_id-varianten).
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS external_post_id TEXT;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS caption TEXT;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS hashtags TEXT[] DEFAULT '{}';
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS impressions INTEGER NOT NULL DEFAULT 0;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS engagements INTEGER NOT NULL DEFAULT 0;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS likes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS comments INTEGER NOT NULL DEFAULT 0;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS shares INTEGER NOT NULL DEFAULT 0;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS campaign_id UUID;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS author_user_id UUID;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Den gamle tabellen har user_id og post_content som NOT NULL. Vi vil
-- ikke kreve dem fra den nye admin-flowen — gjør dem nullable hvis de
-- finnes. (DO-blokken er idempotent og gjør ingenting på frisk tabell.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name='social_media_posts' AND column_name='user_id'
  ) THEN
    EXECUTE 'ALTER TABLE social_media_posts ALTER COLUMN user_id DROP NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name='social_media_posts' AND column_name='post_content'
  ) THEN
    EXECUTE 'ALTER TABLE social_media_posts ALTER COLUMN post_content DROP NOT NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS social_media_posts_platform_idx
  ON social_media_posts (platform, posted_at DESC);
CREATE INDEX IF NOT EXISTS social_media_posts_status_idx
  ON social_media_posts (status, scheduled_for ASC);

-- ───────── marketing_automation_workflows ─────────

CREATE TABLE IF NOT EXISTS marketing_automation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'signup' | 'cart_abandoned' | 'purchase' | 'inactivity' | 'milestone'
  trigger_config JSONB DEFAULT '{}'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{action: 'send_email', template: '...', delay_hours: 24}, ...]
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  total_users_entered INTEGER NOT NULL DEFAULT 0,
  total_users_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_workflows_active_idx
  ON marketing_automation_workflows (is_active, trigger_type);

-- ───────── Seeds ─────────

-- Seed 2 demo-posts (kun hvis tabellen er tom — unngår å fylle prod-tabellen
-- gang etter gang). Inserter inkluderer post_content (legacy NOT NULL) som
-- speilet av caption for kompatibilitet.
DO $$
DECLARE
  has_post_content BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name='social_media_posts' AND column_name='post_content'
  ) INTO has_post_content;

  IF NOT EXISTS (SELECT 1 FROM social_media_posts WHERE caption IS NOT NULL) THEN
    IF has_post_content THEN
      INSERT INTO social_media_posts (platform, caption, post_content, status) VALUES
        ('instagram', 'Velkommen til CreatorHub Norge!', 'Velkommen til CreatorHub Norge!', 'draft'),
        ('linkedin', 'Vi lanserer ny markedsplassfunksjon!', 'Vi lanserer ny markedsplassfunksjon!', 'scheduled');
    ELSE
      INSERT INTO social_media_posts (platform, caption, status) VALUES
        ('instagram', 'Velkommen til CreatorHub Norge!', 'draft'),
        ('linkedin', 'Vi lanserer ny markedsplassfunksjon!', 'scheduled');
    END IF;
  END IF;
END $$;

INSERT INTO marketing_automation_workflows (name, description, trigger_type, steps) VALUES
  ('Welcome series', 'Sender 3 mails over 7 dager til nye brukere', 'signup',
   '[{"action":"send_email","template":"welcome","delay_hours":0},{"action":"send_email","template":"tutorial","delay_hours":48},{"action":"send_email","template":"premium-offer","delay_hours":168}]'::jsonb)
ON CONFLICT (name) DO NOTHING;
