-- 0022_market_insight.sql
--
-- Markedssignaler (offentlige tall) + genererte innsikts-kort per virksomhet.
-- market_signals er global (ikke org-spesifikk): ett sett tall alle deler.
-- insight_cards er per-org: motoren tolker signalene mot virksomhetens tall.

CREATE TABLE market_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                 -- 'norges_bank' | 'ssb'
  kind TEXT NOT NULL,                   -- 'policy_rate' | 'kpi_yoy' | 'fx_rate'
  signal_key TEXT NOT NULL,             -- f.eks. 'KPRA', 'KPI', 'EUR'
  value_num NUMERIC NOT NULL,           -- rå verdi (prosent eller kurs)
  unit TEXT NOT NULL,                   -- 'percent' | 'nok_per_unit'
  period TEXT NOT NULL,                 -- ISO-dato eller 'YYYY-MM' som verdien gjelder
  published_at TIMESTAMPTZ,
  url TEXT,
  raw JSONB,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, kind, signal_key, period)
);
CREATE INDEX market_signals_key_idx ON market_signals (kind, signal_key, period DESC);

CREATE TABLE insight_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  kind TEXT NOT NULL,                   -- regel-id, f.eks. 'rate_debt'
  severity TEXT NOT NULL CHECK (severity IN ('signal','opportunity','watch')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  impact_minor BIGINT,                  -- kroner-effekt (kan være null for rene signal)
  direction TEXT CHECK (direction IN ('cost','benefit','neutral')),
  signal_refs JSONB NOT NULL DEFAULT '[]',  -- [{kind, signal_key, period}]
  sources JSONB NOT NULL DEFAULT '[]',      -- [{label, url}]
  valid_until TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, kind)        -- ett aktivt kort per regel per org; regen overskriver
);
CREATE INDEX insight_cards_org_idx ON insight_cards (organization_id, dismissed_at);
