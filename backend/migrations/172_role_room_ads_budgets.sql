-- Migration 172: Per-project, per-period ads budget cap (MedInnova-avtalen §3).
--
-- §3.1  Kunden fastsetter budsjettet for en gitt periode.
-- §3.2  Budsjettet = maksimal annonsekostnad (eks. Leverandørens påslag).
-- §2.3  Leverandøren kan ikke overskride budsjettet uten Kundens skriftlige
--       forhåndssamtykke → approved_overage_nok registrerer det samtykket.
--
-- max_spend_nok sammenlignes mot faktisk spend_nok (IKKE påslaget), per §3.2.

CREATE TABLE IF NOT EXISTS role_room_ads_budgets (
  project_id VARCHAR NOT NULL,
  period VARCHAR(7) NOT NULL,                 -- YYYY-MM
  max_spend_nok NUMERIC(12,2) NOT NULL,
  -- Skriftlig godkjent ekstra-tak utover max_spend_nok (§2.3).
  approved_overage_nok NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Produsentens forespurte overskridelse som venter på kundens godkjenning.
  overage_requested_nok NUMERIC(12,2),
  overage_note TEXT,
  set_by VARCHAR,
  updated_by VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, period)
);

COMMENT ON COLUMN role_room_ads_budgets.max_spend_nok IS
  'Maks annonsekostnad (eks. påslag) kunden har satt for perioden, §3.2.';
COMMENT ON COLUMN role_room_ads_budgets.approved_overage_nok IS
  'Skriftlig godkjent ekstra-tak utover max_spend_nok (§2.3). effektivt tak = max + overage.';
