-- Henvendelser fra kundens egen nettside, rett inn i Leadgrid.
--
-- Hvorfor det ikke gikk før:
--   POST /api/v1/leads krever en leadgrid_api_keys-nøkkel (mig 325). Den er
--   en HEMMELIGHET — den hashes, den gir lesetilgang til alle leads, og den
--   kan ikke ligge i et skjema på en offentlig nettside. Kundene hadde
--   dermed ingen lovlig måte å sende inn på fra sin egen side.
--
--   Og selv om de hadde: crm_customers har ingen utm-, gclid- eller
--   referrer-felt. En leder som spør «vi får mange henvendelser fra kampanje
--   A, men er det kampanje B som gir de største avtalene?» kunne ikke få
--   svar, fordi koblingen mellom kampanjen og avtalen aldri ble lagret.

-- ── Publiserbar nøkkel per skjema ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_form_endpoints (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        TEXT NOT NULL,
  name              VARCHAR(120) NOT NULL,

  -- Lagres i klartekst MED VILJE. Nøkkelen ligger i HTML-en på en offentlig
  -- nettside; den er en adresse, ikke et passord. Å hashe den ville gitt
  -- falsk trygghet. Sikkerheten ligger i allowed_origins, ratebegrensning
  -- og spamfiltrene — ikke i at nøkkelen er ukjent.
  public_key        VARCHAR(48) NOT NULL UNIQUE,

  -- Tom liste = ingen origin-begrensning (for skjema som sendes fra server).
  -- Satt = bare disse nettstedene slipper til fra en nettleser.
  allowed_origins   TEXT[] NOT NULL DEFAULT '{}',

  -- Per IP per time. Et ekte kontaktskjema sendes én gang; taket er satt for
  -- å stoppe en bot, ikke en travel kunde.
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 20
    CHECK (rate_limit_per_hour > 0 AND rate_limit_per_hour <= 1000),

  -- Hvor brukeren sendes etter en vanlig HTML-form-post. NULL = svar med JSON.
  redirect_url      TEXT,
  -- Settes på leadene som kommer inn her, så de kan skilles i pipelinen.
  lead_source       VARCHAR(80) NOT NULL DEFAULT 'nettskjema',

  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at        TIMESTAMPTZ,

  CONSTRAINT leadgrid_form_endpoints_project_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_form_endpoints_project
  ON leadgrid_form_endpoints (organization_id, project_id)
  WHERE revoked_at IS NULL;

-- ── Innsendingslogg ──────────────────────────────────────────────────────
-- Uten denne kan ingen svare på «vi fikk 40 henvendelser, hvorfor ble det
-- bare 12 leads?». Den bærer også ratebegrensningen, som må overleve at
-- prosessen starter på nytt eller kjører i flere instanser.
CREATE TABLE IF NOT EXISTS leadgrid_form_submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_endpoint_id  UUID NOT NULL REFERENCES leadgrid_form_endpoints(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL,
  project_id        TEXT NOT NULL,

  -- Hvorfor innsendingen ikke ble et lead, når den ikke ble det.
  status            VARCHAR(16) NOT NULL
    CHECK (status IN ('accepted', 'duplicate', 'spam', 'rate_limited', 'invalid')),
  lead_id           UUID,

  -- IP-en lagres ALDRI i klartekst. Hashen er nok til å telle per avsender,
  -- og gjør ikke loggen til et register over hvem som har besøkt en side.
  ip_hash           CHAR(64),
  user_agent        TEXT,
  origin            TEXT,

  -- Kampanjesporing, slik den var på innsendingstidspunktet.
  utm_source        VARCHAR(160),
  utm_medium        VARCHAR(160),
  utm_campaign      VARCHAR(200),
  utm_term          VARCHAR(200),
  utm_content       VARCHAR(200),
  gclid             VARCHAR(255),
  referrer_url      TEXT,
  landing_page_url  TEXT,

  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ratebegrensningen spør «hvor mange fra denne IP-en på dette skjemaet
-- den siste timen».
CREATE INDEX IF NOT EXISTS idx_leadgrid_form_submissions_rate
  ON leadgrid_form_submissions (form_endpoint_id, ip_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leadgrid_form_submissions_project
  ON leadgrid_form_submissions (organization_id, project_id, created_at DESC);

-- ── Kampanjesporing på leadet ────────────────────────────────────────────
-- Dette er det som gjør spørsmålet «hvilken kampanje gir de største
-- avtalene» svarbart: attribusjonen står på bedriften, avtalebeløpet på
-- salget (mig 0635), og de henger sammen via customer_id.
ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS utm_source       VARCHAR(160),
  ADD COLUMN IF NOT EXISTS utm_medium       VARCHAR(160),
  ADD COLUMN IF NOT EXISTS utm_campaign     VARCHAR(200),
  ADD COLUMN IF NOT EXISTS utm_term         VARCHAR(200),
  ADD COLUMN IF NOT EXISTS utm_content      VARCHAR(200),
  -- Google Ads' klikk-id. Uten den kan en vunnet avtale aldri rapporteres
  -- tilbake til Google som offline-konvertering.
  ADD COLUMN IF NOT EXISTS gclid            VARCHAR(255),
  ADD COLUMN IF NOT EXISTS referrer_url     TEXT,
  ADD COLUMN IF NOT EXISTS landing_page_url TEXT;

-- «Hvilke kampanjer ga leads i dette prosjektet.»
CREATE INDEX IF NOT EXISTS idx_crm_customers_utm_campaign
  ON crm_customers (organization_id, project_id, utm_campaign)
  WHERE archived_at IS NULL AND utm_campaign IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_gclid
  ON crm_customers (gclid)
  WHERE gclid IS NOT NULL;
