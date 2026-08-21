-- Skatteavsetning kan plasseres (bank/fond/aksjer) for å øke i verdi før skatten forfaller.
-- Modellen sporer HVOR avsetningen ligger + verdi over tid. Reknaren flytter ALDRI penger,
-- handler ALDRI, og gir ALDRI investeringsråd — kun horisont/likviditet mot forfallskalenderen.

-- 1) Plassering: én "pott" avsetningen ligger i.
CREATE TABLE tax_reserve_placements (
  id                UUID PRIMARY KEY,
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  name              TEXT NOT NULL,
  placement_type    TEXT NOT NULL
                      CHECK (placement_type IN ('bank','money_market_fund','bond_fund','equity_fund','stock')),
  isin              TEXT,
  account_ref       TEXT,
  -- Hvor raskt pengene er tilgjengelig. Kjernen i likviditetsvakten.
  liquidity         TEXT NOT NULL DEFAULT 'instant'
                      CHECK (liquidity IN ('instant','days','short_term','long_term')),
  -- ENK: pengene er IKKE juridisk øremerket. Flagg for tydelig varsling i UI.
  ring_fenced       BOOLEAN NOT NULL DEFAULT false,
  opened_at         DATE NOT NULL,
  closed_at         DATE,
  created_by        UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trp_org ON tax_reserve_placements (organization_id) WHERE closed_at IS NULL;

-- 2) Koble avsetningsloggen til en plassering. NULL = ren kontant (uendret oppførsel).
--    Positiv amount = innskudd (inngangsverdi). Negativ = uttak (fase 2: realiserer gevinst).
ALTER TABLE tax_reserves ADD COLUMN placement_id UUID REFERENCES tax_reserve_placements(id);
CREATE INDEX tax_reserves_placement ON tax_reserves (placement_id) WHERE placement_id IS NOT NULL;

-- 3) Verdi over tid: mark-to-market. Append-only tidsserie (aldri UPDATE).
CREATE TABLE tax_reserve_valuations (
  id                 UUID PRIMARY KEY,
  placement_id       UUID NOT NULL REFERENCES tax_reserve_placements(id),
  valued_at          DATE NOT NULL,
  market_value_minor BIGINT NOT NULL CHECK (market_value_minor >= 0),
  source             TEXT NOT NULL DEFAULT 'manual'
                       CHECK (source IN ('manual','feed')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (placement_id, valued_at)
);
CREATE INDEX trv_latest ON tax_reserve_valuations (placement_id, valued_at DESC);
