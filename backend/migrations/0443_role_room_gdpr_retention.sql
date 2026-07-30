-- 0443_role_room_gdpr_retention.sql
--
-- GDPR-autosletting for Role Room casting-data (Del A punkt 35).
--
-- Bakgrunn: plattformen har brukerinitierte rettigheter (art. 15 innsyn,
-- art. 17 sletting, art. 20 portabilitet) i role-room-talent-gdpr-routes.ts,
-- men ingen AUTOMATISK sletting ved utløpt lagringsfrist. DPA-notatet fører
-- «definer lagringstid per datakategori (særlig casting-media)» som åpent
-- punkt. Denne migreringen legger maskineriet; selve fristene settes som
-- policy-rader og kan endres uten kodeendring.
--
-- Tre tabeller:
--   1. role_room_retention_policies  — hvor lenge hver datakategori lagres
--   2. role_room_retention_deletions — revisjonsspor (art. 5(2) ansvarlighet)
--   3. kolonner for juridisk hold + anonymiseringsmerke
--
-- Ingenting slettes av selve migreringen. Feiingen kjøres av
-- role-room-retention-cron.ts og starter i dry-run til fristene er godkjent.

-- ── 1. Retention-policyer ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_room_retention_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 'platform' = default for alle prosjekter (scope_ref IS NULL)
  -- 'project'  = overstyring for ett prosjekt (scope_ref = casting_projects.id)
  scope_type      VARCHAR(20)  NOT NULL CHECK (scope_type IN ('platform','project')),
  scope_ref       VARCHAR(255),

  -- Datakategori feiingen kjenner igjen. Utvides ved behov — ukjente
  -- kategorier ignoreres av feiingen framfor å feile.
  category        VARCHAR(60)  NOT NULL,

  -- Antall dager etter ankerdatoen før raden er slettbar. 0 = slett straks
  -- ankeret er passert.
  retention_days  INTEGER      NOT NULL CHECK (retention_days >= 0),

  -- Av-bryter per policy. Deaktivert policy = kategorien feies ikke.
  enabled         BOOLEAN      NOT NULL DEFAULT TRUE,

  -- Fritekst: hjemmel/begrunnelse for nettopp denne fristen. Bør fylles ut
  -- før produksjonssetting slik at revisor ser hvorfor tallet er som det er.
  legal_basis     TEXT,

  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by      VARCHAR(255),

  CONSTRAINT rr_retention_policy_scope_ref_shape CHECK (
    (scope_type = 'platform' AND scope_ref IS NULL) OR
    (scope_type = 'project'  AND scope_ref IS NOT NULL)
  )
);

-- Én policy per kategori per scope. Delvise unike indekser fordi NULL ikke
-- teller som lik NULL i en vanlig UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_retention_policy_platform_unique
  ON role_room_retention_policies (category)
  WHERE scope_type = 'platform';

CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_retention_policy_project_unique
  ON role_room_retention_policies (scope_ref, category)
  WHERE scope_type = 'project';

COMMENT ON TABLE role_room_retention_policies IS
  'Lagringstid per datakategori. Prosjekt-scope overstyrer plattform-scope.';
COMMENT ON COLUMN role_room_retention_policies.retention_days IS
  'Dager etter ankerdato før sletting. Ankeret varierer per kategori — se role-room-retention-service.ts.';

-- ── 2. Revisjonsspor ─────────────────────────────────────────────────────
-- GDPR art. 5(2): den behandlingsansvarlige må kunne PÅVISE etterlevelse.
-- Loggen inneholder bevisst ingen personopplysninger — kun hvilken rad som
-- ble slettet, hvorfor, og etter hvilken frist.

CREATE TABLE IF NOT EXISTS role_room_retention_deletions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  category             VARCHAR(60)  NOT NULL,
  entity_type          VARCHAR(60)  NOT NULL,   -- 'casting_candidate' | 'casting_consent' | ...
  entity_id            VARCHAR(255) NOT NULL,
  project_id           VARCHAR(255),

  -- Hvorfor raden var slettbar: 'consent_expired' | 'project_closed' | ...
  reason               VARCHAR(120) NOT NULL,
  retention_days       INTEGER,
  anchor_at            TIMESTAMPTZ,             -- datoen fristen løp fra

  -- Hva som faktisk skjedde. Sletting av media er «best effort»: URL-er som
  -- ikke ligger under vår egen R2-base kan vi bare fjerne referansen til.
  action               VARCHAR(40)  NOT NULL,   -- 'anonymized' | 'deleted' | 'media_purged' | 'token_revoked'
  media_objects_deleted INTEGER     NOT NULL DEFAULT 0,
  media_objects_failed  INTEGER     NOT NULL DEFAULT 0,
  media_external_refs    INTEGER    NOT NULL DEFAULT 0,

  -- TRUE = feiingen rapporterte bare hva den ville gjort.
  dry_run              BOOLEAN      NOT NULL DEFAULT FALSE,

  executed_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  run_id               UUID                                  -- grupperer én feiing
);

CREATE INDEX IF NOT EXISTS idx_rr_retention_deletions_project
  ON role_room_retention_deletions (project_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_retention_deletions_run
  ON role_room_retention_deletions (run_id);
CREATE INDEX IF NOT EXISTS idx_rr_retention_deletions_entity
  ON role_room_retention_deletions (entity_type, entity_id);

COMMENT ON TABLE role_room_retention_deletions IS
  'Revisjonsspor for automatisk sletting (GDPR art. 5(2)). Skal ikke inneholde personopplysninger.';

-- ── 3. Juridisk hold + anonymiseringsmerke ───────────────────────────────
-- Et prosjekt i tvist/rettsak skal ikke autoslettes selv om fristen er ute.

ALTER TABLE casting_projects
  ADD COLUMN IF NOT EXISTS retention_hold        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS retention_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS retention_hold_set_at TIMESTAMPTZ;

COMMENT ON COLUMN casting_projects.retention_hold IS
  'TRUE = unntatt automatisk sletting (tvist, bevaringspålegg). Feiingen hopper over prosjektet.';

-- Anonymiserte kandidater beholder raden (statistikk, budsjettkobling) men
-- uten personopplysninger. Merket hindrer at feiingen tar dem om igjen.
ALTER TABLE casting_candidates
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_casting_candidates_not_anonymized
  ON casting_candidates (project_id)
  WHERE anonymized_at IS NULL;

COMMENT ON COLUMN casting_candidates.anonymized_at IS
  'Satt når personopplysninger er fjernet av retention-feiingen. Raden beholdes uten PII.';

-- ── 4. Plattform-defaults ────────────────────────────────────────────────
-- Konservative startverdier. Disse er IKKE juridisk vurdert ennå — DPA-notatet
-- fører sletteregler som åpent punkt. Feiingen starter derfor i dry-run
-- (RR_RETENTION_ENFORCE=false), slik at radene kan justeres uten at noe
-- slettes utilsiktet.

INSERT INTO role_room_retention_policies (scope_type, scope_ref, category, retention_days, legal_basis)
VALUES
  -- Samtykket er utløpt → grunnlaget for å lagre media er borte. Kort frist.
  ('platform', NULL, 'expired_consent_media',      30,
   'Behandlingsgrunnlaget bortfaller når samtykket utløper (art. 6(1)(a)). Kort etterslep for feilretting.'),

  -- Kandidater som ikke gikk videre — ingen kontraktsgrunnlag å lagre på.
  ('platform', NULL, 'rejected_candidate_media',   90,
   'Ikke-valgte kandidater: ingen kontrakt å oppfylle (art. 6(1)(b)). Frist dekker klage/omgjøring.'),

  -- Avsluttet prosjekt → PII anonymiseres, raden beholdes for statistikk.
  ('platform', NULL, 'closed_project_candidates', 365,
   'Avsluttet produksjon. Ett år dekker etterarbeid og reklamasjon; deretter anonymiseres PII.'),

  -- Delingslenker som har passert utløp skal ikke ligge igjen som hemmelighet.
  ('platform', NULL, 'expired_selftape_links',      7,
   'Utløpt delingslenke skal ikke kunne gjenoppstå. Token og passord-hash nulles.')
ON CONFLICT DO NOTHING;
