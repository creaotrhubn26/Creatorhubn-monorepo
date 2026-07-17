-- 333_ai_overage_accrual.sql
-- Fase B av "soft-cap + overage"-modellen for CreatorHub-plattformen.
-- Akkumulerer AI-forbrukskostnad per organisasjon per kalendermåned, sammenligner
-- mot inkludert AI-budsjett for planen, og beregner (men BELASTER IKKE) et
-- overage-beløp. Ingen skriving til Stripe skjer i Fase B — kun regnskap/synlighet.
-- Fase C (metered billing) leser billed_at/stripe_customer_id herfra.

CREATE TABLE IF NOT EXISTS ai_overage_accrual (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL,
  -- Første dag i måneden (YYYY-MM-01) i UTC — én rad per org per måned.
  period_month       DATE NOT NULL,
  -- Plan-id løst på beregningstidspunkt (basic/professional/premium/enterprise).
  -- Kan være NULL hvis planen ikke lot seg utlede (flagges i tjenesten).
  plan_id            TEXT,
  -- Inkludert AI-budsjett for planen, i NOK (underliggende leverandør-kost).
  included_cost_nok  NUMERIC(12,4) NOT NULL DEFAULT 0,
  -- Faktisk AI-leverandørkost brukt denne måneden, i NOK.
  actual_cost_nok    NUMERIC(12,4) NOT NULL DEFAULT 0,
  -- max(0, actual - included) — rå overskridelse i leverandørkost (NOK).
  overage_cost_nok   NUMERIC(12,4) NOT NULL DEFAULT 0,
  -- overage_cost_nok * markup — beløpet som ville blitt fakturert (NOK).
  overage_charge_nok NUMERIC(12,4) NOT NULL DEFAULT 0,
  -- Markup brukt ved beregning (lagres for revisjon; default 1.4).
  markup             NUMERIC(6,3) NOT NULL DEFAULT 1.4,
  -- Beste-innsats kobling til Stripe-kunde for Fase C. NULL = kan ikke faktureres enda.
  stripe_customer_id TEXT,
  -- Settes av Fase C når meter-event er rapportert til Stripe. NULL i Fase B.
  billed_at          TIMESTAMPTZ,
  computed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_ai_overage_accrual_period
  ON ai_overage_accrual (period_month);

-- Uforfakturerte overskridelser med kjent Stripe-kunde = Fase C-arbeidskøen.
CREATE INDEX IF NOT EXISTS idx_ai_overage_accrual_unbilled
  ON ai_overage_accrual (period_month)
  WHERE billed_at IS NULL AND overage_charge_nok > 0;
