-- Migration 131: Per-project material-approval policy.
--
-- MedInnova-avtalen §5.1 krever som default at KUNDEN godkjenner materiell før
-- publisering. Men dette skal være et valg kunden selv kan styre: en kunde som
-- stoler på produsenten kan tillate at produsenten også godkjenner (raskere
-- flyt). require_client_approval = true (default) = streng §5.1.

CREATE TABLE IF NOT EXISTS role_room_approval_settings (
  project_id VARCHAR PRIMARY KEY,
  require_client_approval BOOLEAN NOT NULL DEFAULT true,
  updated_by VARCHAR,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN role_room_approval_settings.require_client_approval IS
  'true (default) = bare klient (client_reviewer) kan godkjenne for publisering (§5.1). false = produsent kan også godkjenne. Settes av kunden.';
