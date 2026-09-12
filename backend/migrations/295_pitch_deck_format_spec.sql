-- =====================================================================
-- 295_pitch_deck_format_spec.sql
--
-- Utvider Pitch Deck Studio fra MVP-9-slides til den fulle pitch-spec'en:
--   - Master: 11 slides (cover, intro, problem, current_friction,
--             solution, how_it_works, core_features, before_after,
--             value, pilot, next_step)
--   - Short:  10 slides (samme, droppe core_features for møtebruk)
--
-- Retningslinjer som styrer hva Claude lager:
--   * Én idé per slide (maks ~50 ord body)
--   * Mørkt/premium visuell stil (allerede i PresentView)
--   * Lite tekst, mye visuelt — derfor egne JSONB-kolonner for
--     bullets (ikoner+labels), before_after (to kolonner), og
--     mockup_urls (skjermbilder)
--
-- Cover-slide skal vise organisasjonens logo + tagline. Vi auto-fetcher
-- begge fra org-website ved onboard og lagrer på deck-nivå (ikke per
-- slide) så ev. re-generering ikke trenger å re-fetche.
-- =====================================================================

BEGIN;

-- ─── 1. Utvid pitch_decks m/ cover-felter + format ─────────────
ALTER TABLE pitch_decks
  ADD COLUMN IF NOT EXISTS format VARCHAR(10) NOT NULL DEFAULT 'long'
    CHECK (format IN ('long','short')),
  ADD COLUMN IF NOT EXISTS cover_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_tagline TEXT,
  -- Snapshot av siste cover-fetch — gir oss et "fetched_at" å sammenligne
  -- mot website-endringer + tillater å re-fetche stille.
  ADD COLUMN IF NOT EXISTS cover_fetched_at TIMESTAMPTZ;

-- ─── 2. Utvid pitch_slides m/ strukturert visuelt innhold ──────
-- bullets:       For core_features-slide. Form: [{icon, label, body?}].
-- before_after:  For before_after-slide. Form: {before:[...], after:[...]}.
-- mockup_urls:   For how_it_works/solution/demo. Form: [{url, caption?}].
-- one_idea:      Den ene ideen per slide (ekstrahert fra title_md eller
--                manuelt satt). Brukes av live AI-cue til å vurdere om
--                en slide bør hoppes over basert på samtalen.
ALTER TABLE pitch_slides
  ADD COLUMN IF NOT EXISTS bullets JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS before_after JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS mockup_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS one_idea TEXT;

-- ─── 3. Utvid slide_type CHECK ─────────────────────────────────
-- DROP og re-create constraint siden vi legger til 8 nye verdier.
-- Beholder de 'gamle' så eksisterende rader ikke brytes.
ALTER TABLE pitch_slides
  DROP CONSTRAINT IF EXISTS pitch_slides_slide_type_check;

ALTER TABLE pitch_slides
  ADD CONSTRAINT pitch_slides_slide_type_check
  CHECK (slide_type IN (
    -- Nye etter pitch-spec:
    'cover',           -- Logo + tagline + org-navn
    'intro',           -- Kort introduksjon (hva produktet er)
    'problem',         -- Problemet — utfordringer
    'current_friction',-- Hvorfor dagens løsninger ikke er nok
    'solution',        -- Løsningen som helhetlig system
    'how_it_works',    -- Produktflyt + mockup
    'core_features',   -- Kjernefunksjoner — ikoner + korte labels
    'before_after',    -- Før/etter — to kolonner
    'value',           -- Verdien — koblet til forretningsverdi (lead-tilpasset)
    'pilot',           -- Pilot / anbefalt start
    'next_step',       -- Neste steg — CTA
    -- Gamle (bakoverkompatibilitet for eksisterende decks):
    'insight','demo','target','differentiator','proof','business','ask','custom'
  ));

-- ─── 4. Per-lead Value-slide-overstyringer ──────────────────────
-- Når Verdien-sliden tilpasses et spesifikt lead, overskriver vi IKKE
-- master-slide-raden — vi lagrer overstyringen på presentations-raden
-- så master-decket forblir generisk. Render-laget viser override hvis
-- raden eksisterer.
ALTER TABLE pitch_deck_presentations
  ADD COLUMN IF NOT EXISTS value_slide_override JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pre_meeting_brief JSONB DEFAULT NULL;

-- pre_meeting_brief-formet:
--   { recommended_slide_ids: [uuid, ...],
--     talking_points: { "<slide_id>": "ord til selger" },
--     objections: [{ q: "...", a: "..." }, ...],
--     generated_at: timestamp,
--     claude_model: "..." }

-- ─── 5. Slide-import / mockup-uploads sporing ───────────────────
-- En enkel logg over mockup-uploads så vi kan ttl-sentral-rydde
-- bilder som ikke lenger refereres fra noen slide.
CREATE TABLE IF NOT EXISTS pitch_deck_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES pitch_decks(id) ON DELETE CASCADE,
  slide_id UUID REFERENCES pitch_slides(id) ON DELETE SET NULL,
  asset_type VARCHAR(20) NOT NULL
    CHECK (asset_type IN ('cover_logo','mockup','before_image','after_image','icon')),
  b2_key TEXT NOT NULL,
  mime_type VARCHAR(60),
  uploaded_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pitch_deck_assets_deck
  ON pitch_deck_assets(deck_id, asset_type);

COMMIT;
