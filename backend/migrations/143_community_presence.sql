-- Migration 143: community_presence
--
-- Verktøy for å koordinere ekstern presence på community-plattformer
-- (Product Hunt, Reddit, Indie Hackers, BetaList, Hacker News, Discord,
-- film-blogger osv.). AdminRoom administrerer dette via en
-- "Presence"-tab, og The Role Room Agent kan generere post-utkast +
-- foreslå outreach-rekkefølge.
--
-- Modell:
--   community_channels  = plattformene vi spores på (Product Hunt, Reddit, etc.)
--   community_posts     = enkelt-poster per kanal (planlagt → utkast → publisert)
--   outreach_contacts   = journalister, bloggere, community-managers vi
--                         vil pitche til
--
-- Channel-driven: hver kanal har sin egen kanal-konto (handle, URL),
-- mens posts knytter seg til en spesifikk kanal og kan ha en agent-
-- generert utkast-tekst.

CREATE TABLE IF NOT EXISTS community_channels (
  id            varchar PRIMARY KEY,
  -- Kanal-type identifiserer plattformen — 'product_hunt' | 'reddit' |
  -- 'indie_hackers' | 'beta_list' | 'hacker_news' | 'discord' |
  -- 'twitter' | 'linkedin' | 'tiktok' | 'youtube' | 'blog' | 'other'
  channel_type  varchar(40) NOT NULL,
  -- Visning-navn (f.eks. "r/Filmmakers" eller "Product Hunt")
  display_name  text NOT NULL,
  -- For subreddits: "r/Filmmakers". For Discord: server-navn. For
  -- blogger: domenenavn. URL og handle separat under.
  handle        text,
  url           text,
  -- Hvor mange medlemmer/subscribers (manuelt oppdatert for sortering)
  audience_size integer,
  -- Notater om hvordan kanalen brukes (regler, beste tid, kontakter)
  notes         text,
  -- Status: 'planned' = vurderer, 'active' = aktivt jobber, 'paused',
  -- 'won' = vi har breakthrough her, 'lost' = funket ikke
  status        varchar(20) NOT NULL DEFAULT 'planned',
  -- Prioritet 1-5 (1 = topp)
  priority      integer NOT NULL DEFAULT 3,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    varchar
);

CREATE INDEX IF NOT EXISTS community_channels_type_idx ON community_channels (channel_type);
CREATE INDEX IF NOT EXISTS community_channels_status_idx ON community_channels (status);
CREATE INDEX IF NOT EXISTS community_channels_priority_idx ON community_channels (priority);

CREATE TABLE IF NOT EXISTS community_posts (
  id              varchar PRIMARY KEY,
  channel_id      varchar NOT NULL REFERENCES community_channels(id) ON DELETE CASCADE,
  -- Type post: 'launch_post' | 'show_hn' | 'ama' | 'comment' | 'feedback_request'
  post_type       varchar(40) NOT NULL DEFAULT 'launch_post',
  title           text NOT NULL,
  body            text,
  -- Hvilken målgruppe innenfor kanalen ('filmmakers', 'students', etc.)
  audience_tag    text,
  -- Status: 'draft' | 'review' | 'scheduled' | 'published' | 'responded' | 'archived'
  status          varchar(20) NOT NULL DEFAULT 'draft',
  scheduled_for   timestamptz,
  published_at    timestamptz,
  published_url   text,
  -- Engagement-metrics (manuelt oppdatert eller via API senere)
  upvotes         integer,
  comments_count  integer,
  -- Hvis utkastet er AI-generert via The Role Room Agent
  ai_generated    boolean NOT NULL DEFAULT false,
  ai_model        varchar(64),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      varchar
);

CREATE INDEX IF NOT EXISTS community_posts_channel_id_idx ON community_posts (channel_id);
CREATE INDEX IF NOT EXISTS community_posts_status_idx ON community_posts (status);
CREATE INDEX IF NOT EXISTS community_posts_scheduled_idx ON community_posts (scheduled_for) WHERE scheduled_for IS NOT NULL;

CREATE TABLE IF NOT EXISTS outreach_contacts (
  id              varchar PRIMARY KEY,
  name            text NOT NULL,
  role            text,
  -- Hvilken organisasjon de tilhører (NRK, Rushprint, P3, NFI, etc.)
  organization    text,
  email           text,
  -- Sosiale handles for asynkron outreach
  twitter_handle  text,
  linkedin_url    text,
  -- Hvor relevant er denne for oss (1-5, 1 = topp prioritert)
  priority        integer NOT NULL DEFAULT 3,
  -- Status: 'not_contacted' | 'reached_out' | 'responded' | 'meeting_scheduled' |
  --          'covered' | 'no_response' | 'not_interested'
  status          varchar(30) NOT NULL DEFAULT 'not_contacted',
  -- Når sist vi pitched dem
  last_contacted  timestamptz,
  -- Fri-tekst-notater (hva vi har snakket om, neste steg, etc.)
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      varchar
);

CREATE INDEX IF NOT EXISTS outreach_contacts_org_idx ON outreach_contacts (organization);
CREATE INDEX IF NOT EXISTS outreach_contacts_status_idx ON outreach_contacts (status);

-- Trigger for updated_at på alle tre tabeller — samme mønster som migrasjon 141.
CREATE OR REPLACE FUNCTION community_presence_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS community_channels_updated_at_trigger ON community_channels;
CREATE TRIGGER community_channels_updated_at_trigger
  BEFORE UPDATE ON community_channels
  FOR EACH ROW EXECUTE FUNCTION community_presence_set_updated_at();

DROP TRIGGER IF EXISTS community_posts_updated_at_trigger ON community_posts;
CREATE TRIGGER community_posts_updated_at_trigger
  BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION community_presence_set_updated_at();

DROP TRIGGER IF EXISTS outreach_contacts_updated_at_trigger ON outreach_contacts;
CREATE TRIGGER outreach_contacts_updated_at_trigger
  BEFORE UPDATE ON outreach_contacts
  FOR EACH ROW EXECUTE FUNCTION community_presence_set_updated_at();

-- Seed defaults — de viktigste kanalene vi vil spore fra dag 1.
-- ON CONFLICT DO NOTHING så seed-en er idempotent ved migrate-rerun.
INSERT INTO community_channels (id, channel_type, display_name, handle, url, audience_size, priority, status, notes)
VALUES
  ('seed-producthunt', 'product_hunt', 'Product Hunt', 'theroleroom', 'https://producthunt.com/posts/theroleroom', NULL, 1, 'planned', 'Launch-mål: top 5 på dagen. Forberedelse: 5-7 hunter-relations + maker-comment'),
  ('seed-betalist', 'beta_list', 'BetaList', 'theroleroom', 'https://betalist.com', NULL, 2, 'planned', 'Submit som casting platform. ~$129 paid eller gratis kø'),
  ('seed-indiehackers', 'indie_hackers', 'Indie Hackers', 'theroleroom', 'https://indiehackers.com', NULL, 2, 'planned', 'Build-in-public-tråd: "Building Norway''s casting OS"'),
  ('seed-hn', 'hacker_news', 'Hacker News (Show HN)', NULL, 'https://news.ycombinator.com', NULL, 1, 'planned', 'Show HN: "Norway''s casting OS". Tirsdag kl 16-18 UTC'),
  ('seed-reddit-filmmakers', 'reddit', 'r/Filmmakers', 'r/Filmmakers', 'https://reddit.com/r/Filmmakers', 1400000, 1, 'planned', 'Gi verdi 2-3 uker FØR egen-post. Strict no-promo-regler'),
  ('seed-reddit-cinematography', 'reddit', 'r/Cinematography', 'r/Cinematography', 'https://reddit.com/r/Cinematography', 550000, 2, 'planned', NULL),
  ('seed-reddit-indiefilm', 'reddit', 'r/IndieFilm', 'r/IndieFilm', 'https://reddit.com/r/IndieFilm', 110000, 2, 'planned', NULL),
  ('seed-reddit-norge', 'reddit', 'r/Norge', 'r/Norge', 'https://reddit.com/r/Norge', NULL, 3, 'planned', 'Norsk publikum'),
  ('seed-discord-cinedb', 'discord', 'Cinematography Database', NULL, 'https://discord.gg/cinematographydatabase', NULL, 3, 'planned', NULL),
  ('seed-discord-nofilmschool', 'discord', 'No Film School', NULL, 'https://discord.gg/nofilmschool', NULL, 3, 'planned', NULL),
  ('seed-blog-rushprint', 'blog', 'Rushprint', NULL, 'https://rushprint.no', NULL, 2, 'planned', 'Norsk film-tidsskrift'),
  ('seed-blog-p3', 'blog', 'P3 Filmpolitiet', NULL, 'https://p3.no/filmpolitiet/', NULL, 2, 'planned', NULL),
  ('seed-blog-aftenposten-kultur', 'blog', 'Aftenposten Kultur', NULL, 'https://aftenposten.no/kultur', NULL, 3, 'planned', NULL),
  ('seed-g2', 'other', 'G2 Crowd', NULL, 'https://g2.com', NULL, 2, 'planned', 'Registrer som "Casting Software"'),
  ('seed-capterra', 'other', 'Capterra', NULL, 'https://capterra.com', NULL, 2, 'planned', NULL)
ON CONFLICT (id) DO NOTHING;
