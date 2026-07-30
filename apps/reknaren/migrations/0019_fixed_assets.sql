-- 0019_fixed_assets.sql
--
-- Anleggsmiddelregister for saldoavskrivning (skatteloven §14-41/§14-43).
-- Hver eiendel plasseres i en saldogruppe (a–j) med lovbestemt maks avskrivnings-
-- sats. Selve avskrivningen beregnes deterministisk fra registeret (år for år,
-- degressivt på gruppens samlede saldo) — ingen årlig saldo lagres her, den
-- utledes fra anskaffelser/utrangeringer. Bokføring skjer som eget avskrivnings-
-- bilag i hovedboken (append-only), ikke her.

CREATE TABLE fixed_assets (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  saldo_group CHAR(1) NOT NULL CHECK (saldo_group IN ('a','b','c','d','e','f','g','h','i','j')),
  acquisition_date DATE NOT NULL,
  cost_minor BIGINT NOT NULL CHECK (cost_minor >= 0),
  -- Balansekontoen eiendelen står på (f.eks. 1200/1250/1280).
  ledger_account TEXT NOT NULL DEFAULT '1200',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disposed','expensed')),
  disposal_date DATE,
  disposal_proceeds_minor BIGINT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fixed_assets_org ON fixed_assets (organization_id);
