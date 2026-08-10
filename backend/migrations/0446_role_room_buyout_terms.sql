-- 0446_role_room_buyout_terms.sql
--
-- Del A punkt 47: strukturerte buyout-felter. «For reklame er dette selve
-- kontrakten» — territorium, medieflater, rettighetsperiode og eksklusivitet
-- er det som faktisk prises og forhandles.
--
-- I dag finnes buyout kun som en enum-VERDI ('buyout') på contractType, mens
-- selve vilkårene ligger som fritekst i JSONB-blober i legacy_compat_store.
-- Det gjør to ting umulig:
--   1. Å prise/sammenligne buyouts maskinelt.
--   2. Å svare på «hvilke rettigheter utløper neste måned» — som er nettopp
--      det punkt 46 (kontraktsarkiv med utløpsvarsling) trenger. Dyre
--      bransjeproblemer oppstår når en film ligger ute etter at retten gikk ut.
--
-- Derfor egen tabell framfor flere JSONB-felter: perioden må kunne indekseres.
--
-- Kontrakts-id-en peker inn i JSONB-bloben og kan ikke ha fremmednøkkel.
-- Prosjektet kan, og har det — opprydding følger prosjektet.

CREATE TABLE IF NOT EXISTS role_room_buyout_terms (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id     VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  -- Id-en til kontrakten/tilbudet i legacy_compat_store-bloben.
  contract_id    VARCHAR(255) NOT NULL,
  candidate_id   VARCHAR(255),
  role_id        VARCHAR(255),

  -- ── Omfang ────────────────────────────────────────────────────────────
  -- Hvor rettighetene gjelder. Fritekst-territorier (enkeltland utenfor
  -- listene) legges i territories_note.
  territories    TEXT[] NOT NULL DEFAULT '{}',
  territories_note TEXT,

  -- Hvilke flater materialet kan brukes på.
  media_channels TEXT[] NOT NULL DEFAULT '{}',

  -- ── Periode ───────────────────────────────────────────────────────────
  -- Enten et konkret intervall, eller «evigvarende» (unlimited = TRUE).
  -- Utløpsvarslingen i punkt 46 leser ends_at.
  starts_at      DATE,
  ends_at        DATE,
  unlimited      BOOLEAN NOT NULL DEFAULT FALSE,

  -- ── Eksklusivitet ─────────────────────────────────────────────────────
  -- 'category' er det vanlige i reklame: skuespilleren kan ikke gjøre reklame
  -- for konkurrenter i samme kategori, men gjerne i andre.
  exclusivity          VARCHAR(20) NOT NULL DEFAULT 'none',
  exclusivity_category TEXT,

  -- ── Opsjon på forlengelse ─────────────────────────────────────────────
  renewal_option       BOOLEAN NOT NULL DEFAULT FALSE,
  renewal_fee          NUMERIC(12,2),
  -- Hvor mange dager før utløp opsjonen må utøves. Driver varslingen.
  renewal_notice_days  INTEGER,

  -- ── Vederlag ──────────────────────────────────────────────────────────
  fee            NUMERIC(12,2),
  currency       VARCHAR(10) NOT NULL DEFAULT 'NOK',

  notes          TEXT,
  created_by     VARCHAR(255),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ett sett vilkår per kontrakt.
  CONSTRAINT rr_buyout_terms_contract_unique UNIQUE (project_id, contract_id),

  -- Vokabular håndheves i databasen. text[] framfor JSONB nettopp fordi
  -- `<@` gjør dette i én operator — Postgres tillater ikke subqueries i CHECK.
  CONSTRAINT rr_buyout_territories_vocab CHECK (
    territories <@ ARRAY['norway','nordics','europe','world','online_only']::text[]
  ),
  CONSTRAINT rr_buyout_media_vocab CHECK (
    media_channels <@ ARRAY['tv','online','social','cinema','print','ooh','radio','instore']::text[]
  ),
  CONSTRAINT rr_buyout_exclusivity_vocab CHECK (
    exclusivity IN ('none','category','full')
  ),

  -- Perioden må gå riktig vei.
  CONSTRAINT rr_buyout_period_order CHECK (
    starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at
  ),

  -- Evigvarende buyout har ingen sluttdato — de to utelukker hverandre.
  -- Uten dette ville en rad kunne se ut som både tidsbegrenset og evig, og
  -- utløpsvarslingen ville ikke visst hva den skulle tro.
  CONSTRAINT rr_buyout_unlimited_has_no_end CHECK (
    NOT (unlimited = TRUE AND ends_at IS NOT NULL)
  ),

  -- Kategori-eksklusivitet uten oppgitt kategori er ikke håndhevbart.
  CONSTRAINT rr_buyout_category_requires_name CHECK (
    exclusivity <> 'category' OR (exclusivity_category IS NOT NULL AND trim(exclusivity_category) <> '')
  ),

  -- Opsjonsfrist gir bare mening når det finnes en opsjon.
  CONSTRAINT rr_buyout_renewal_fields_need_option CHECK (
    renewal_option = TRUE OR (renewal_fee IS NULL AND renewal_notice_days IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_rr_buyout_terms_project
  ON role_room_buyout_terms (project_id);

-- Bærer utløpsvarslingen (punkt 46): «hvilke rettigheter utløper innen X».
CREATE INDEX IF NOT EXISTS idx_rr_buyout_terms_expiry
  ON role_room_buyout_terms (ends_at)
  WHERE ends_at IS NOT NULL AND unlimited = FALSE;

CREATE INDEX IF NOT EXISTS idx_rr_buyout_terms_candidate
  ON role_room_buyout_terms (candidate_id)
  WHERE candidate_id IS NOT NULL;

COMMENT ON TABLE role_room_buyout_terms IS
  'Strukturerte buyout-vilkår per kontrakt (Del A punkt 47). Bærer utløpsvarslingen i punkt 46.';
COMMENT ON COLUMN role_room_buyout_terms.contract_id IS
  'Kontraktens id i legacy_compat_store-bloben. Ingen FK — bloben er ikke en tabell.';
COMMENT ON COLUMN role_room_buyout_terms.unlimited IS
  'TRUE = evigvarende kjøp. Utelukker ends_at.';
