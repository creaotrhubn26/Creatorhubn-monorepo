-- 0335_multi_product_admin_room.sql
--
-- Multi-produkt-utvidelse for Admin Room-flater som tidligere kun var
-- Role Room-spesifikke. Etter Leadgrid har blitt løftet til andre
-- flaggskip under CreatorHub (jf. LEADGRID-PRODUKTDOKUMENTASJON.md §1.4),
-- må super_admin kunne vedlikeholde ÉN forretningsplan og ETT outreach-
-- bibliotek PER PRODUKT.
--
-- Endringer:
--   1) admin_business_plan: én rad per (user_id, product_key) i stedet
--      for kun (user_id). DEFAULT product_key = 'role_room' bevarer
--      eksisterende rad.
--   2) role_room_outreach_templates: legg product_key (DEFAULT 'role_room'
--      for eksisterende seedede templates). Slug-unike per produkt.
--   3) Seed Leadgrid outreach-templates fra LEADGRID-OUTREACH-PLAN.md
--      (mal F1-A, F1-B, F2 markedssjef, F2 franchise-HQ, F3 bransje-
--      forening, F3 ad-partner, F3 integration-partner).
--
-- Idempotent: alle ALTER er IF NOT EXISTS, alle INSERT er ON CONFLICT
-- DO NOTHING.

------------------------------------------------------------
-- 1) admin_business_plan: legg product_key, flytt UNIQUE
------------------------------------------------------------
ALTER TABLE admin_business_plan
  ADD COLUMN IF NOT EXISTS product_key VARCHAR(20) NOT NULL DEFAULT 'role_room';

-- Drop gammel UNIQUE(user_id) hvis den finnes (auto-generert constraint-navn
-- fra Postgres er `admin_business_plan_user_id_key`)
ALTER TABLE admin_business_plan
  DROP CONSTRAINT IF EXISTS admin_business_plan_user_id_key;

-- Ny composite UNIQUE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_business_plan_user_product_key'
  ) THEN
    ALTER TABLE admin_business_plan
      ADD CONSTRAINT admin_business_plan_user_product_key
      UNIQUE (user_id, product_key);
  END IF;
END$$;

-- CHECK-constraint på lovlige product_key-verdier
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_business_plan_product_key_check'
  ) THEN
    ALTER TABLE admin_business_plan
      ADD CONSTRAINT admin_business_plan_product_key_check
      CHECK (product_key IN ('role_room', 'leadgrid'));
  END IF;
END$$;

------------------------------------------------------------
-- 2) role_room_outreach_templates: legg product_key
------------------------------------------------------------
ALTER TABLE role_room_outreach_templates
  ADD COLUMN IF NOT EXISTS product_key VARCHAR(20) NOT NULL DEFAULT 'role_room';

-- CHECK-constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_room_outreach_templates_product_key_check'
  ) THEN
    ALTER TABLE role_room_outreach_templates
      ADD CONSTRAINT role_room_outreach_templates_product_key_check
      CHECK (product_key IN ('role_room', 'leadgrid'));
  END IF;
END$$;

-- Drop gammel UNIQUE (user_id, slug); ny er per produkt.
ALTER TABLE role_room_outreach_templates
  DROP CONSTRAINT IF EXISTS role_room_outreach_templates_user_id_slug_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_room_outreach_templates_user_slug_product_key'
  ) THEN
    ALTER TABLE role_room_outreach_templates
      ADD CONSTRAINT role_room_outreach_templates_user_slug_product_key
      UNIQUE (user_id, slug, product_key);
  END IF;
END$$;

-- Indeks for produkt-filter (queries er WHERE product_key = $1)
CREATE INDEX IF NOT EXISTS idx_outreach_templates_product
  ON role_room_outreach_templates (product_key);

------------------------------------------------------------
-- 2b) role_room_industry_targets: legg product_key
-- (samme produkt som tilhørende outreach-templates — targets er
-- per-segment-listen som vises i Admin Room → Outreach)
------------------------------------------------------------
ALTER TABLE role_room_industry_targets
  ADD COLUMN IF NOT EXISTS product_key VARCHAR(20) NOT NULL DEFAULT 'role_room';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_room_industry_targets_product_key_check'
  ) THEN
    ALTER TABLE role_room_industry_targets
      ADD CONSTRAINT role_room_industry_targets_product_key_check
      CHECK (product_key IN ('role_room', 'leadgrid'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_industry_targets_product
  ON role_room_industry_targets (product_key);

------------------------------------------------------------
-- 2c) updated_by-kolonner for e2e sync-historikk
-- Lar UI-en vise "sist oppdatert X minutter siden av Y".
-- Audit-loggen (admin_activity_log) gir full historikk; disse to
-- kolonnene gjør at vi slipper join hver gang vi viser "sist endret".
------------------------------------------------------------
ALTER TABLE admin_business_plan
  ADD COLUMN IF NOT EXISTS updated_by VARCHAR;

ALTER TABLE role_room_outreach_templates
  ADD COLUMN IF NOT EXISTS updated_by VARCHAR;

ALTER TABLE role_room_industry_targets
  ADD COLUMN IF NOT EXISTS updated_by VARCHAR;

------------------------------------------------------------
-- 3) Seed Leadgrid outreach-templates (default, globale)
------------------------------------------------------------
-- Default-templates har user_id = NULL. Disse seedes idempotent.

INSERT INTO role_room_outreach_templates
  (user_id, slug, title, segment, channel, language, description, body, is_default, product_key)
VALUES
  (NULL,
   'lg-f1-byraeier-no',
   'Fase 1 — B2B-byrå-eier (NO)',
   'b2b_agency',
   'dm',
   'no',
   'LinkedIn-DM til byrå-eier. Selger transparens-leveranse til byråets egne kunder.',
   E'Hei {{name}},\n\nSå at {{company}} leverte {{recent_case}} — {{specific_point}}.\n\nEt ærlig spørsmål — ikke en pitch: hvordan rapporterer dere spend → faktisk omsetning til kundene deres i dag? PowerPoint hver mandag, eller noe annet?\n\nJeg spør fordi vi bygger Leadgrid — kart-først CRM for B2B-feltsalg + innebygget white-label klient-portal. Sluttkunden ser hva som leveres i sanntid; dere slipper Excel-arbeid hver fredag.\n\nVi er i tidlig fase og leter etter 5 byråer som vil være med å forme produktet. Gratis tilgang i 6 måneder mot ærlig tilbakemelding.\n\n30 minutter — jeg kommer til dere, eller vi tar Google Meet?\n\nDaniel',
   TRUE,
   'leadgrid'),

  (NULL,
   'lg-f1-markedssjef-byra-no',
   'Fase 1 — Markedssjef i byrå (NO)',
   'b2b_agency',
   'dm',
   'no',
   'LinkedIn-DM til markedssjef i et B2B-byrå. Selger live team-pins som differensiering.',
   E'Hei {{name}},\n\nSå at du har bygget {{team_or_company}} til {{team_size}} selgere i {{region}}. Et ærlig spørsmål: når en ny lead skal kalles, vet selgerne deres hvor de fysisk er i forhold til de andre kundene de dekker?\n\nVi bygger Leadgrid — feltsalgs-CRM med live team-pins på iPaden. GDPR-opt-in, ingen spionvare. Markedssjefen ser teamet på kartet i sanntid.\n\n6 mnd gratis Agency-tier hvis du vil prøve. 20 min?\n\nDaniel',
   TRUE,
   'leadgrid'),

  (NULL,
   'lg-f2-markedssjef-intern-no',
   'Fase 2 — Markedssjef i intern markedsavdeling (NO)',
   'marketing_director',
   'email',
   'no',
   'E-post til markedssjef i SMB-B2B (telekom/energi/agro/foodservice/eiendom).',
   E'Hei {{name}},\n\nSå at dere kjører {{recent_campaign}} for {{product}}. Et ærlig spørsmål — ikke en pitch: vet du i dag hvor mange av disse klikkene som faktisk ble til betalende kunder?\n\nVi bygger Leadgrid — kart-først CRM som kobler Google/Meta-conversion-rules direkte til lead-en på kartet, som blir kunde, som blir Stripe-faktura. Hele kjeden i ett blikk.\n\nVil du se hvordan det ser ut? 20 minutter, jeg viser deg en demo med iPaden.\n\nDaniel',
   TRUE,
   'leadgrid'),

  (NULL,
   'lg-f2-franchise-hq-no',
   'Fase 2 — Franchise-hovedkontor (NO)',
   'franchise_hq',
   'email',
   'no',
   'E-post til franchise-hovedkontor som koordinerer 10+ franchisetakere.',
   E'Hei {{name}},\n\nSå at {{company}} har {{franchise_count}} franchisetakere i Norge. Hvordan sørger dere for at alle har samme arbeidsflyt når de tar inn nye B2B-kunder lokalt?\n\nVi bygger Leadgrid — kart-først CRM med salgshierarki som førsteklasses primitiv: hovedkontoret ser hele nettverket på kartet, hver franchisetaker eier sin egen pipeline, og rapporter rulles opp automatisk.\n\n6 mnd gratis Agency-tier mot ærlig tilbakemelding. 30 min for å vise demo?\n\nDaniel',
   TRUE,
   'leadgrid'),

  (NULL,
   'lg-f3-bransjeforening-no',
   'Fase 3 — Bransjeforening (NO)',
   'industry_assoc',
   'email',
   'no',
   'E-post til direktør i bransjeforening (NHO Service / Energi Norge / Abelia / NHO Mat og Drikke).',
   E'Hei {{name}},\n\nVi har bygget Leadgrid — et kart-først CRM for B2B-feltsalg som har spesialisert seg på {{industry}} (vi har data fra {{data_points}}+ besøk i sektoren).\n\nForslag: et co-webinar {{target_month}} om «Spend → omsetning-rapportering for {{industry}}». Jeg leverer dataene + verktøyet, dere har rekkevidden mot medlemmene.\n\nTil gjengjeld kan vi tilby medlemmer 3 mnd gratis Solo Pro + 30 % rabatt første år på Agency.\n\n20 min for å diskutere?\n\nDaniel',
   TRUE,
   'leadgrid'),

  (NULL,
   'lg-f3-ad-partner-en',
   'Fase 3 — Ad partner program (EN)',
   'ad_partner',
   'email',
   'en',
   'Partner-application e-post til Meta/Google/LinkedIn/TikTok partner-programs.',
   E'Hi {{name}},\n\nWe are Leadgrid — a map-first B2B field-sales CRM with native conversion-tracking integration for {{platform}} ads. We have currently {{customer_count}} agencies running customer campaigns through our stack and we''re applying to formalize our partnership with {{platform}}.\n\nKey datapoints: {{key_metric_1}}, {{key_metric_2}}, {{key_metric_3}}.\n\nWould you have 30 min to review our partnership application and discuss co-marketing opportunities for the Nordic market?\n\nDaniel Qazi\nFounder, Creatorhub AS (creatorhubn.com)',
   TRUE,
   'leadgrid'),

  (NULL,
   'lg-f3-integration-partner-no',
   'Fase 3 — Integrasjons-partner (Tripletex/Visma/PowerOffice, NO)',
   'integration_partner',
   'email',
   'no',
   'E-post til norsk regnskaps-/ERP-leverandør for marketplace-listing + eksport-integrasjon.',
   E'Hei {{name}},\n\nLeadgrid er et kart-først CRM for B2B-feltsalg som lukker loopen fra lead → kunde → faktisk omsetning. Mange av våre kunder bruker {{partner_product}} for regnskap.\n\nForslag: vi bygger en eksport-integrasjon (lukket omsetning fra Leadgrid → {{partner_product}}-faktura) + tar listing på deres marketplace. Til gjengjeld kan vi co-promotere {{partner_product}} i vår onboarding-flyt for nye Agency-kunder.\n\n30 min for å diskutere teknisk + kommersielt?\n\nDaniel',
   TRUE,
   'leadgrid')
ON CONFLICT (user_id, slug, product_key) DO NOTHING;

------------------------------------------------------------
-- 4) Kommentarer for fremtidige migrasjoner
------------------------------------------------------------
COMMENT ON COLUMN admin_business_plan.product_key IS
  'Hvilket produkt forretningsplanen tilhører. Gir én rad per (user_id, product_key) — super_admin kan ha plan for role_room + leadgrid parallelt. Standard: role_room (eksisterende rader bevares).';

COMMENT ON COLUMN role_room_outreach_templates.product_key IS
  'Hvilket produkt outreach-templaten gjelder. role_room-templates skjuler ikke leadgrid-templates og omvendt — front-end-filter på produkt-velger.';
