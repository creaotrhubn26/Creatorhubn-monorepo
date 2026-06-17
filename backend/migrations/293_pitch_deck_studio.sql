-- =====================================================================
-- 293_pitch_deck_studio.sql
--
-- Pitch Deck Studio inne i Lead Map: hver organisasjon har sin egen
-- master-deck som genereres fra hva organisasjonen selger. Selgere
-- åpner decket fra leadkart eller lead-detail, og bruker det i
-- presentasjons-modus på iPad (sveip + Pencil-annotering). Avhengig
-- av at organisasjonen har skrudd på `pitch_deck.access`-permissionen
-- (se 0294). Eksport til PDF er en separat permission (`pitch_deck.
-- export`) fordi en presentatør ikke nødvendigvis skal kunne lekke
-- filen utenfor.
--
-- Datamodell:
--   pitch_decks               — én eller flere decks per org
--   pitch_slides              — slidene; position-ordnet, regenererbare
--   pitch_deck_presentations  — én rad per faktisk presentasjon ute
--                               (lead-koblet, m/ annotasjons-JSON +
--                               utfalls-status). Mater Lead Map sin
--                               status-flyt.
--   pitch_deck_exports        — én rad pr PDF-eksport. Vi gir kunden
--                               en signed URL m/ tracking-pixel, så
--                               selgeren får push når deck'et åpnes.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS pitch_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name VARCHAR(120) NOT NULL DEFAULT 'Master pitch',

  -- Brukerens svar i onboarding-wizardet — bevares så Claude kan
  -- regenerere enkelt-slides senere uten å spørre om alt igjen.
  -- Form (validert i backend, ikke i SQL):
  --   { industry, one_liner, target_customer,
  --     pains: [string,string,string],
  --     differentiators: [string,string,string],
  --     proof_points: [string,string,string],
  --     locale: 'nb' | 'en' }
  generated_from JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 'draft'      = ikke generert ennå (kun onboarding-data)
  -- 'generating' = Claude jobber
  -- 'ready'      = klar til bruk
  -- 'archived'   = ikke aktiv lenger, men beholdt for historikk
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','generating','ready','archived')),

  -- Inkrement hver gang Claude bygger på nytt fra bunnen. Per-slide-
  -- regenerering oppdaterer kun slide-rad, ikke deck-versjonen.
  version INT NOT NULL DEFAULT 1,

  last_used_at TIMESTAMPTZ,
  created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pitch_decks_org_status
  ON pitch_decks(org_id, status) WHERE status <> 'archived';
CREATE INDEX IF NOT EXISTS idx_pitch_decks_org_last_used
  ON pitch_decks(org_id, last_used_at DESC NULLS LAST);

-- ─────────────────────────────────────────────────────────────────
-- pitch_slides
-- Ordnet etter (deck_id, position). Position-int er glissent (10,
-- 20, 30 …) så vi kan sette inn slides imellom uten å re-numerere
-- hele decket; UI normaliserer ved lagring.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pitch_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES pitch_decks(id) ON DELETE CASCADE,

  position INT NOT NULL,

  -- En av standard-typene Claude genererer + 'custom' for manuelt
  -- innsatte slides. Drives av UI-rendring (problem-slide ser
  -- annerledes ut enn proof-slide).
  slide_type VARCHAR(40) NOT NULL DEFAULT 'custom'
    CHECK (slide_type IN (
      'problem','insight','solution','demo','target',
      'differentiator','proof','business','ask','custom'
    )),

  title_md TEXT NOT NULL DEFAULT '',
  body_md TEXT NOT NULL DEFAULT '',

  -- Valgfri bilde-URL (B2). Settes av brukeren via opplastning eller
  -- av Claude via image-gen i en senere fase.
  visual_url TEXT,

  -- Sporbarhet — hvilket Claude-run la siste versjonen av denne
  -- sliden. Bruker UUID for å koble til claude_runs-tabellen hvis
  -- vi vil ha audit på prompt/usage senere.
  claude_run_id UUID,

  -- Når noen redigerer manuelt, frys ned auto-regenerering for å
  -- ikke overskrive arbeidet. UI viser et lite "låst"-ikon. Kan
  -- låses opp manuelt.
  locked_by_user VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (deck_id, position)
);

CREATE INDEX IF NOT EXISTS idx_pitch_slides_deck
  ON pitch_slides(deck_id, position);

-- ─────────────────────────────────────────────────────────────────
-- pitch_deck_presentations
-- Én rad per faktisk presentasjon foran en kunde. Koblet til en
-- lead i Lead Map så vi kan rapportere "decks brukt → demo booket"
-- som ren conversion-funnel.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pitch_deck_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES pitch_decks(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- NULL = øvings-presentasjon ("alene foran speilet"); ikke-NULL =
  -- ekte presentasjon ute hos en lead. Bare ikke-NULL teller i
  -- conversion-rapporter.
  -- Lead i Lead Map = crm_customers-rad m/ lead_status. Soft FK
  -- (TEXT) fordi crm_customers.id-typen varierer (UUID på nye, varchar
  -- på legacy) og vi vil ikke risikere migrasjons-rekkefølge-feil.
  lead_id TEXT,

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,

  -- Hvilke slide-id'er ble faktisk vist? Selger kan ha hoppet over
  -- noen. Brukes til "hvilke slides traff?"-analyse.
  slides_shown UUID[] NOT NULL DEFAULT '{}',

  -- Per-slide Pencil-annotasjoner. Form:
  --   { "<slide_id>": { "png_b64": "...", "drawn_at": "..." } }
  -- Vi lagrer inline (ikke B2) fordi det typisk er små stroke-
  -- overlays og vi vil ha dem garantert med presentasjons-loggen.
  annotations JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Selgers utfalls-vurdering rett etter presentasjon. Mater
  -- Lead Map status-flyt og neste follow-up automatisk.
  outcome VARCHAR(30)
    CHECK (outcome IS NULL OR outcome IN (
      'demo_booked','interested','more_info','lost','follow_up'
    )),
  outcome_note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pitch_presentations_deck
  ON pitch_deck_presentations(deck_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pitch_presentations_user
  ON pitch_deck_presentations(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pitch_presentations_lead
  ON pitch_deck_presentations(lead_id) WHERE lead_id IS NOT NULL;

-- Funnel-rapport: org → demo_booked-rate fra deck-presentasjoner. Joines
-- via deck_id → pitch_decks → org_id, så ingen denorm.
CREATE INDEX IF NOT EXISTS idx_pitch_presentations_outcome
  ON pitch_deck_presentations(deck_id, outcome)
  WHERE outcome IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- pitch_deck_exports
-- Sporing av PDF-eksporter. opened_at + view_count fylles av en
-- public tracking-pixel-route som dekkfilens HTML/PDF inkluderer.
-- Selger får push-varsel ved første åpning.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pitch_deck_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES pitch_decks(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- NULL = "min eksport" (selger laster ned selv); ikke-NULL =
  -- "delt med denne lead'en".
  lead_id TEXT,

  -- B2-key i bucket the-role-room-prod. Signed URL bygges on-demand
  -- så lenken ikke leaker hvis raden lekker.
  b2_key TEXT NOT NULL,

  -- Engangs-token i URL'en (?t=...) — så vi kan måle visning uten
  -- at deck_id eksponeres i klartext.
  view_token VARCHAR(64) NOT NULL UNIQUE,

  -- Sporing
  first_opened_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  view_count INT NOT NULL DEFAULT 0,

  -- Selger-notifisert ved første åpning?
  notified_on_open BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_pitch_exports_deck
  ON pitch_deck_exports(deck_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pitch_exports_user
  ON pitch_deck_exports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pitch_exports_lead
  ON pitch_deck_exports(lead_id) WHERE lead_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- updated_at-triggere
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pitch_decks_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pitch_decks_set_updated_at ON pitch_decks;
CREATE TRIGGER trg_pitch_decks_set_updated_at
  BEFORE UPDATE ON pitch_decks
  FOR EACH ROW EXECUTE FUNCTION pitch_decks_set_updated_at();

DROP TRIGGER IF EXISTS trg_pitch_slides_set_updated_at ON pitch_slides;
CREATE TRIGGER trg_pitch_slides_set_updated_at
  BEFORE UPDATE ON pitch_slides
  FOR EACH ROW EXECUTE FUNCTION pitch_decks_set_updated_at();

COMMIT;
-- re-trigger (2314) --
