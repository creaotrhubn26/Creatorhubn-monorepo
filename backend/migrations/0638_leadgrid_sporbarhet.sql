-- Sporbarhet: hvordan leads spores, hvor kunden kom fra, hva det kostet,
-- og hva de kjøpte.
--
-- Spørsmålene en markedssjef stiller, og hvor svaret ligger ETTER denne
-- migrasjonen:
--   «Hvordan spores leads?»        leadgrid_tracking_setup
--   «Hvor kom kunden fra?»         crm_customers.utm_* + klikk-ID (mig 0637)
--   «Hva kostet det?»              leadgrid_campaign_spend via
--                                  leadgrid_campaign_links
--   «Hva kjøpte de?»               leadgrid_deal_line_items (mig 0633) via
--                                  leadgrid_deals (mig 0635)
--
-- Alt her er Leadgrids egne tabeller. Role Room har tilsvarende data i
-- ads_campaigns og ads_attribution_daily (mig 128), men de er nøklet på
-- byråets prosjektbegrep og user_id, uten organization_id. Å låne dem ville
-- lagt Leadgrid-kundenes tall i byråets datamodell — feil eierskap, feil
-- livsløp, og umulig å skille ad hvis en kunde forlater byrået.

-- ── Hva som er satt opp på kundens nettsted ──────────────────────────────
-- Markedssjefen spør: «hvordan spores leads, og hvor kom kunden fra?»
-- Første del av svaret er en liste over hva som faktisk er installert.
-- Vi kan ikke se GTM eller GA4 fra serveren vår; det er kunden som forteller
-- oss hva som ligger der. Derfor er dette et register, ikke en måling — og
-- oversikten sier tydelig hvilke rader som er ubekreftede.
CREATE TABLE IF NOT EXISTS leadgrid_tracking_setup (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        TEXT NOT NULL,

  kind              VARCHAR(20) NOT NULL
    CHECK (kind IN ('gtm', 'ga4', 'meta_pixel', 'tiktok_pixel', 'google_ads',
                    'linkedin_insight', 'clarity')),
  -- GTM-container (GTM-XXXX), GA4 measurement id (G-XXXX), pixel-id, osv.
  external_id       VARCHAR(120) NOT NULL,
  label             VARCHAR(160),
  -- Hvordan raden kom hit. Et skann finner ID-en i sidekilden; det er ikke
  -- det samme som at noen har bekreftet at den er riktig. Skillet gjør at
  -- oversikten kan vise hva som er sjekket av et menneske.
  source            VARCHAR(10) NOT NULL DEFAULT 'manuell'
    CHECK (source IN ('manuell', 'skann')),
  -- Variabelnavnet ID-en sto i, når den ble funnet av et skann.
  funnet_som        VARCHAR(120),
  notes             TEXT,

  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leadgrid_tracking_setup_project_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_tracking_setup
  ON leadgrid_tracking_setup (organization_id, project_id, kind, external_id)
  WHERE active;

-- ── Kampanjer og kostnad, Leadgrids egne ────────────────────────────────
-- Kostnadsdata FINNES allerede i ads_attribution_daily (mig 128) — men den
-- henger på ads_campaigns, som er Role Rooms tabell: nøklet på deres
-- prosjektbegrep og user_id, uten organization_id. Å låne den ville lagt
-- Leadgrid-kundenes kostnadstall i byråets datamodell, med feil eierskap og
-- feil livsløp. Leadgrid får sine egne.
--
-- Broen som må finnes uansett: leadet bærer utm_campaign, som er en
-- TEKSTSTRENG kunden selv velger. Kostnaden hører til en kampanje-id hos
-- plattformen. Det er to helt ulike identifikatorer, og å gjette at de
-- matcher ville gitt tall som ser riktige ut og er feil.
--
-- Mangler koblingen, skal oversikten si «ikke koblet» — aldri vise kostnad
-- per lead regnet som om annonsene var gratis.
CREATE TABLE IF NOT EXISTS leadgrid_campaign_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        TEXT NOT NULL,

  -- Verdien slik den står i utm_campaign på leadet.
  utm_campaign      VARCHAR(200) NOT NULL,
  platform          VARCHAR(12) NOT NULL
    CHECK (platform IN ('google', 'meta', 'tiktok', 'linkedin')),
  -- Kampanje-id-en hos plattformen. Det er denne kostnaden føres på.
  external_campaign_id VARCHAR(120) NOT NULL,
  label             VARCHAR(200),

  created_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leadgrid_campaign_links_project_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- Én kobling per kampanjenavn per prosjekt. To ville betydd dobbelt kostnad.
CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_campaign_links
  ON leadgrid_campaign_links (organization_id, project_id, utm_campaign);

-- Kostnaden per kampanje per dag. Hentes fra plattformen via prosjektets egen
-- kobling (leadgrid_ads_destinations), eller føres manuelt av kunden som
-- kjører annonsene selv. source sier hvilken av delene, så ingen tror et
-- manuelt tall er hentet fra Google.
CREATE TABLE IF NOT EXISTS leadgrid_campaign_spend (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        TEXT NOT NULL,
  platform          VARCHAR(12) NOT NULL
    CHECK (platform IN ('google', 'meta', 'tiktok', 'linkedin')),
  external_campaign_id VARCHAR(120) NOT NULL,

  date              DATE NOT NULL,
  spend             NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (spend >= 0),
  currency          VARCHAR(3) NOT NULL DEFAULT 'NOK',
  impressions       BIGINT,
  clicks            BIGINT,

  source            VARCHAR(10) NOT NULL DEFAULT 'api'
    CHECK (source IN ('api', 'manual')),
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leadgrid_campaign_spend_project_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- Én rad per kampanje per dag. Uten dette ville en ny henting lagt kostnaden
-- oppå den gamle i stedet for å erstatte den.
CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_campaign_spend_day
  ON leadgrid_campaign_spend (organization_id, project_id, platform, external_campaign_id, date);

CREATE INDEX IF NOT EXISTS idx_leadgrid_campaign_spend_range
  ON leadgrid_campaign_spend (organization_id, project_id, date DESC);
