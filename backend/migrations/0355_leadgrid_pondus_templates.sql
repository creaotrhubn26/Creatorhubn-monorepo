-- =====================================================================
-- mig 0355 — Leadgrid Pondus: maler, versjons-historikk, per-steg
--            innholds-varianter
--
-- Pondus er et Leadgrid-produkt som leverer ferdige salgs-maler
-- («pondus-scripts») for felt-, tele-, video- og e-post-kontakt. Målet:
-- SuperAdmin (Leadgrid-staff) skal kunne definere + publisere maler som
-- deretter er tilgjengelig for alle innloggede brukere — og org-admin
-- kan i tillegg lage egne, private maler til sin org.
--
-- «Levere maler … men det må ikke være hardkodet her kan super admin
-- legge til og publisere slik at andre brukere får tilgang» (Daniel,
-- 2026-07-01).
--
-- Tabeller som lages (3):
--   1. pondus_templates          — mal-oppslag (Leadgrid-global ELLER org-lokal)
--   2. pondus_template_versions  — audit + rollback (snapshot pr. redigering)
--   3. pondus_content_by_step    — per-steg bibliotek med varianter
--
-- Publiseringsmodell:
--   • org_id IS NULL + is_published = TRUE  → Leadgrid-global (alle orgs)
--   • org_id = <uuid>                         → org-lokal (bare den org-en)
--   • is_published = FALSE                    → utkast (kun redaktør ser)
--
-- Auth-modell:
--   • Kun SuperAdmin (users.role IN ('admin','super_admin')) kan
--     opprette/publisere Leadgrid-globale maler (org_id = NULL). Backend
--     håndhever 403; migrasjonen sier ikke noe om det.
--   • En eventuell org-admin-modus (opprette org-lokale maler) kan
--     legges til i backend uten skjema-endring.
--
-- Konvensjoner (matcher 0349/0353/0354):
--   • organizations(id) = UUID, ON DELETE CASCADE
--   • users(id)         = VARCHAR(255) (IKKE UUID)
--   • PK               = UUID DEFAULT gen_random_uuid()
--   • Timestamps        = TIMESTAMPTZ NOT NULL DEFAULT now()
--   • Idempotent        = IF NOT EXISTS overalt
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. pondus_templates — mal-oppslag
-- ─────────────────────────────────────────────────────────────────────
-- steps JSONB-form:
--   [
--     {
--       "id": "formal",              -- stabil nøkkel (matcher pondus_content_by_step.step_key)
--       "title": "Formål",
--       "subtitle": "Åpning av samtalen",
--       "icon": "target",            -- SF Symbols-navn (Swift-siden)
--       "prompt": "Skap et sterkt førsteinntrykk ...",
--       "minLength": null,
--       "maxLength": 200,
--       "order": 0
--     },
--     ...
--   ]
--
-- objections JSONB-form:
--   [
--     { "id": "price", "prompt": "«For dyrt»", "response": "Hva sammenligner du oss med?" }
--   ]
--
-- score = 0–100 (auto-Pondus-score fra AI, kan justeres av redaktør)
-- category = åpen streng (backend-konvensjon: 'first_contact',
--   'meeting_open', 'price_objection', 'decision_maker', 'follow_up',
--   'custom' — utvidbart uten migrasjon)
-- kind = 'telephone' | 'video' | 'email' | 'meeting' | 'field'
CREATE TABLE IF NOT EXISTS pondus_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT,
  category       VARCHAR(60) NOT NULL,
  kind           VARCHAR(20) NOT NULL,
  score          INT NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  steps          JSONB NOT NULL DEFAULT '[]'::jsonb,
  objections     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by     VARCHAR(255),
  org_id         UUID REFERENCES organizations(id) ON DELETE CASCADE,
  is_published   BOOLEAN NOT NULL DEFAULT FALSE,
  published_at   TIMESTAMPTZ,
  published_by   VARCHAR(255),
  version        INT NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vanlig list-spørring: hva er publisert for meg (Leadgrid-global +
-- min org)? — dekket av (is_published, org_id) partial index.
CREATE INDEX IF NOT EXISTS idx_pondus_templates_published_org
  ON pondus_templates(is_published, org_id);
CREATE INDEX IF NOT EXISTS idx_pondus_templates_org
  ON pondus_templates(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pondus_templates_global
  ON pondus_templates(is_published) WHERE org_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_pondus_templates_category
  ON pondus_templates(category, is_published);
CREATE INDEX IF NOT EXISTS idx_pondus_templates_kind
  ON pondus_templates(kind, is_published);
CREATE INDEX IF NOT EXISTS idx_pondus_templates_created_by
  ON pondus_templates(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pondus_templates_published_by
  ON pondus_templates(published_by) WHERE published_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pondus_templates_created_at
  ON pondus_templates(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 2. pondus_template_versions — audit + rollback
-- ─────────────────────────────────────────────────────────────────────
-- Skrives ved hver PATCH (backend bumper pondus_templates.version + inserter
-- én rad her m/ hele mal-snapshot). Rollback = kopier snapshot tilbake til
-- pondus_templates + bump version.
CREATE TABLE IF NOT EXISTS pondus_template_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  UUID NOT NULL REFERENCES pondus_templates(id) ON DELETE CASCADE,
  version      INT NOT NULL,
  snapshot     JSONB NOT NULL,
  changed_by   VARCHAR(255),
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_pondus_template_versions_template
  ON pondus_template_versions(template_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_pondus_template_versions_changed_by
  ON pondus_template_versions(changed_by) WHERE changed_by IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 3. pondus_content_by_step — varianter for enkelt-steg
-- ─────────────────────────────────────────────────────────────────────
-- Lar SuperAdmin/org-admin publisere flere varianter (A/B) av samme
-- steg (f.eks. tre ulike åpningsreplikker for «Første kontakt»-malen).
-- step_key = stabil ID fra pondus_templates.steps[].id.
CREATE TABLE IF NOT EXISTS pondus_content_by_step (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES pondus_templates(id) ON DELETE CASCADE,
  step_key      VARCHAR(60) NOT NULL,
  variant_name  TEXT NOT NULL,
  content_text  TEXT NOT NULL,
  score         INT NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  created_by    VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pondus_content_by_step_template
  ON pondus_content_by_step(template_id, step_key);
CREATE INDEX IF NOT EXISTS idx_pondus_content_by_step_created_by
  ON pondus_content_by_step(created_by) WHERE created_by IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- SEED — 5 default Leadgrid-globale maler
-- ─────────────────────────────────────────────────────────────────────
-- created_by / published_by = NULL → indikerer system-seed (backend
-- viser «Leadgrid» som redaktør-navn for slike rader).
-- ON CONFLICT DO NOTHING via UNIQUE-check på (name, org_id IS NULL) —
-- fordi bordet ikke har den constrainten, bruker vi NOT EXISTS-guard
-- for full idempotens ved rerun.
--
-- Steg-strukturen matcher iPad-mock i LeadbookView.swift (PondusData.templates).

-- Seed 1: Første kontakt med Pondus (telephone, score 82)
INSERT INTO pondus_templates
  (name, description, category, kind, score, steps, objections,
   created_by, org_id, is_published, published_at, published_by, version)
SELECT
  'Første kontakt med Pondus',
  'Skap et sterkt førsteinntrykk og åpne for dialog med kalde leads.',
  'first_contact',
  'telephone',
  82,
  '[
    {"id":"formal","title":"Formål","subtitle":"","icon":"target","prompt":"Få kontaktpersonen nysgjerrig, etablere troverdighet og avtale et kort møte.","minLength":null,"maxLength":null,"order":0},
    {"id":"opening","title":"Åpningsreplikk","subtitle":"","icon":"bubble.left.fill","prompt":"Hei {navn}, jeg heter {ditt navn} i {din bedrift}. Vi hjelper {målgruppe} med {kjerneverdi}.","minLength":null,"maxLength":200,"order":1},
    {"id":"value","title":"Verdiforslag","subtitle":"","icon":"diamond.fill","prompt":"Vi har nylig hjulpet {kunde} med å {konkret resultat}. Tror du dette kan være relevant for dere også?","minLength":null,"maxLength":200,"order":2},
    {"id":"needs","title":"Behovsspørsmål","subtitle":"","icon":"questionmark.circle.fill","prompt":"Hva er viktigst å få til i år innen {område}?","minLength":null,"maxLength":150,"order":3},
    {"id":"trust","title":"Tillitssignaler","subtitle":"","icon":"checkmark.shield.fill","prompt":"Vi jobber med selskaper som {kundetyper} og har gjennomsnittlig {resultat/besparelse}.","minLength":null,"maxLength":150,"order":4},
    {"id":"objections","title":"Innvendinger","subtitle":"","icon":"exclamationmark.circle.fill","prompt":"Vanlig: «Ikke relevant nå». Svar: «Skjønner godt. Hva er på plass for at det skulle vært aktuelt å se på dette senere?»","minLength":null,"maxLength":200,"order":5},
    {"id":"next","title":"Neste steg","subtitle":"","icon":"arrow.right.circle.fill","prompt":"Har du 15 minutter til en kort prat denne uken, eller passer det bedre til uken?","minLength":null,"maxLength":150,"order":6}
  ]'::jsonb,
  '[
    {"id":"not_relevant","prompt":"Ikke relevant nå","response":"Hva er på plass for at det skulle vært aktuelt å se på dette senere?"},
    {"id":"send_email","prompt":"Send info på e-post","response":"Selvfølgelig! Hva er den beste e-posten å sende det til?"}
  ]'::jsonb,
  NULL, NULL, TRUE, now(), NULL, 1
WHERE NOT EXISTS (
  SELECT 1 FROM pondus_templates
   WHERE name = 'Første kontakt med Pondus' AND org_id IS NULL
);

-- Seed 2: Møteåpning med Pondus (video, score 91)
INSERT INTO pondus_templates
  (name, description, category, kind, score, steps, objections,
   created_by, org_id, is_published, published_at, published_by, version)
SELECT
  'Møteåpning med Pondus',
  'Sett agendaen og etabler verdi fra start i digitale møter.',
  'meeting_open',
  'video',
  91,
  '[
    {"id":"formal","title":"Formål","subtitle":"","icon":"target","prompt":"Etabler eierskap til samtalen + sikre at agenda gir gjensidig verdi.","minLength":null,"maxLength":null,"order":0},
    {"id":"agenda","title":"Agenda-forslag","subtitle":"","icon":"calendar","prompt":"Jeg har satt opp 15 min: 5 til å forstå dere, 5 til å vise hva som virker hos andre, og 5 til neste steg. Funker det?","minLength":null,"maxLength":200,"order":1},
    {"id":"frame","title":"Ramme-spørsmål","subtitle":"","icon":"bubble.left.fill","prompt":"Før vi går i gang: hva er det viktigste å få ut av denne samtalen for dere?","minLength":null,"maxLength":150,"order":2},
    {"id":"value","title":"Verdiforslag","subtitle":"","icon":"diamond.fill","prompt":"Vi har sett at {kundetype} ofte sliter med {hovedutfordring} — det er det vi kan løse.","minLength":null,"maxLength":200,"order":3},
    {"id":"confirm","title":"Bekreft videre","subtitle":"","icon":"arrow.right.circle.fill","prompt":"Stemmer det vi snakker om med det dere håpet på?","minLength":null,"maxLength":100,"order":4}
  ]'::jsonb,
  '[]'::jsonb,
  NULL, NULL, TRUE, now(), NULL, 1
WHERE NOT EXISTS (
  SELECT 1 FROM pondus_templates
   WHERE name = 'Møteåpning med Pondus' AND org_id IS NULL
);

-- Seed 3: Prisinnvending med Pondus (telephone, score 76)
INSERT INTO pondus_templates
  (name, description, category, kind, score, steps, objections,
   created_by, org_id, is_published, published_at, published_by, version)
SELECT
  'Prisinnvending med Pondus',
  'Håndter prisinnvendinger uten å miste momentum.',
  'price_objection',
  'telephone',
  76,
  '[
    {"id":"formal","title":"Formål","subtitle":"","icon":"target","prompt":"Avdekk hva som ligger bak prisinnvendingen og bygg verdi-grunnlag.","minLength":null,"maxLength":null,"order":0},
    {"id":"acknowledge","title":"Anerkjenn","subtitle":"","icon":"checkmark.shield.fill","prompt":"Skjønner godt det — pris er en viktig faktor.","minLength":null,"maxLength":100,"order":1},
    {"id":"clarify","title":"Avklar","subtitle":"","icon":"questionmark.circle.fill","prompt":"Når du sier dyrt — hva sammenligner du oss med?","minLength":null,"maxLength":100,"order":2},
    {"id":"reframe","title":"Reframe","subtitle":"","icon":"diamond.fill","prompt":"Vår erfaring er at de som velger billigere ender opp med {konkret konsekvens} etter 6–12 mnd.","minLength":null,"maxLength":200,"order":3}
  ]'::jsonb,
  '[
    {"id":"too_expensive","prompt":"Det er for dyrt","response":"Hva er viktigst for dere — pris eller total verdi over tid?"}
  ]'::jsonb,
  NULL, NULL, TRUE, now(), NULL, 1
WHERE NOT EXISTS (
  SELECT 1 FROM pondus_templates
   WHERE name = 'Prisinnvending med Pondus' AND org_id IS NULL
);

-- Seed 4: Beslutningstaker-dialog (email, score 85)
INSERT INTO pondus_templates
  (name, description, category, kind, score, steps, objections,
   created_by, org_id, is_published, published_at, published_by, version)
SELECT
  'Beslutningstaker-dialog',
  'Engasjer beslutningstakere og få respons på e-post.',
  'decision_maker',
  'email',
  85,
  '[
    {"id":"formal","title":"Formål","subtitle":"","icon":"target","prompt":"Få beslutningstaker til å allokere 15–20 min.","minLength":null,"maxLength":null,"order":0},
    {"id":"subject","title":"Emnefelt","subtitle":"","icon":"envelope.fill","prompt":"{Selskap} — 3 spørsmål som tar 2 min","minLength":null,"maxLength":60,"order":1},
    {"id":"opening","title":"Åpning","subtitle":"","icon":"bubble.left.fill","prompt":"{Navn} — jeg vet du har lite tid. Tre korte spørsmål:","minLength":null,"maxLength":100,"order":2},
    {"id":"core","title":"Kjernen","subtitle":"","icon":"list.bullet","prompt":"(1) Er {tema} relevant? (2) Hvem eier dette internt? (3) Når er rett tid å se på det?","minLength":null,"maxLength":200,"order":3},
    {"id":"cta","title":"Mikro-CTA","subtitle":"","icon":"arrow.right.circle.fill","prompt":"Et JA, NEI, eller «spør om 2 mnd» er nok.","minLength":null,"maxLength":100,"order":4}
  ]'::jsonb,
  '[]'::jsonb,
  NULL, NULL, TRUE, now(), NULL, 1
WHERE NOT EXISTS (
  SELECT 1 FROM pondus_templates
   WHERE name = 'Beslutningstaker-dialog' AND org_id IS NULL
);

-- Seed 5: Oppfølging med Pondus (email, score 79)
INSERT INTO pondus_templates
  (name, description, category, kind, score, steps, objections,
   created_by, org_id, is_published, published_at, published_by, version)
SELECT
  'Oppfølging med Pondus',
  'Hold momentum i oppfølgingssekvensen etter tilbud.',
  'follow_up',
  'email',
  79,
  '[
    {"id":"formal","title":"Formål","subtitle":"","icon":"target","prompt":"Bring samtalen videre uten å virke masete.","minLength":null,"maxLength":null,"order":0},
    {"id":"anchor","title":"Anker forrige møte","subtitle":"","icon":"bubble.left.fill","prompt":"«Sist snakket vi om {tema}. Har det landet noe hos deg?»","minLength":null,"maxLength":150,"order":1},
    {"id":"nudge","title":"Nudge","subtitle":"","icon":"arrow.right.circle.fill","prompt":"«Jeg holder plassen din varm til fredag — trenger du en avklaring før da?»","minLength":null,"maxLength":150,"order":2}
  ]'::jsonb,
  '[]'::jsonb,
  NULL, NULL, TRUE, now(), NULL, 1
WHERE NOT EXISTS (
  SELECT 1 FROM pondus_templates
   WHERE name = 'Oppfølging med Pondus' AND org_id IS NULL
);

COMMIT;
