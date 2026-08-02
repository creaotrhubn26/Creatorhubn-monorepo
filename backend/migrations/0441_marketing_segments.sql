-- 0441_marketing_segments.sql
--
-- Fase 1 av «målrettet markedsføring»-broen (audience graph): definer et segment
-- → resolver medlemmer → materialiser til en ad-audience → lagre koblingen
-- (grafkanten) så den kan refreshes/attribueres per segment senere.
--
-- MVP-kilde: role_room_industry_targets (Tier-1/ICP-CRM med e-post). Kilden
-- 'leadgrid_leads' (crm_customers) er reservert for fase 2 — de radene er
-- bedrifter fra kart/Brønnøysund UTEN e-postkolonne og kan ikke materialiseres
-- til Google Customer Match før en kontakt-/e-postkilde finnes.
--
-- NB: Render har ingen preDeploy-migrasjon — servicen self-healer tabellene
-- lazily (ensureTables), så denne fila er den kanoniske skjemadefinisjonen.

CREATE TABLE IF NOT EXISTS marketing_segments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  name        VARCHAR(120) NOT NULL,
  source      VARCHAR(32) NOT NULL DEFAULT 'industry_targets', -- utvidbart: leadgrid_leads (fase 2)
  filters     JSONB NOT NULL DEFAULT '{}'::jsonb,               -- { tiers:[], segments:[], statuses:[] }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_segments_user
  ON marketing_segments (user_id);

-- Grafkanten: ett segment kan materialiseres til flere plattform-audiences.
CREATE TABLE IF NOT EXISTS marketing_segment_audiences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id            UUID NOT NULL REFERENCES marketing_segments(id) ON DELETE CASCADE,
  platform              VARCHAR(32) NOT NULL,               -- 'google_customer_match' (MVP)
  external_audience_id  TEXT,                               -- userListResource fra plattformen
  member_count          INTEGER NOT NULL DEFAULT 0,
  status                VARCHAR(24) NOT NULL DEFAULT 'pending', -- pending | synced | failed
  last_error            TEXT,
  last_synced_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (segment_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_marketing_segment_audiences_segment
  ON marketing_segment_audiences (segment_id);
