-- =====================================================================
-- 272_lead_map_multi_tenant.sql
--
-- Wave LM-Agent Fase 1 — Multi-tenant data-isolation for Lead Map.
--
-- Strategi:
--   - Eksisterende crm_customers er Daniels personlige CRM (Marketing Cockpit).
--     Disse beholder agent_config_id = NULL og fortsetter å filtreres på
--     owner_user_id.
--   - Nye klient-Agent-flow får agent_config_id = <client_ads_configs.id>.
--     Hver byrås klient får isolert lead-rom. owner_user_id forblir
--     produsenten som administrerer kontoen.
--
-- Backwards-compat:
--   - Eksisterende rader: agent_config_id = NULL (Daniels personlige bruk)
--   - Eksisterende /admin-room/lead-map/* routes filtrerer
--     agent_config_id IS NULL
--   - Nye /role-room/agent/configs/:id/lead-map/* routes filtrerer
--     agent_config_id = <id>
-- =====================================================================

BEGIN;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS agent_config_id UUID;

-- Soft FK — bruker REFERENCES bare hvis client_ads_configs eksisterer.
-- Vi setter UUID-typen direkte siden client_ads_configs.id er UUID
-- (verifisert i migrasjon 254). Sletting av config sletter ikke leads —
-- byrået kan ha verdifulle leads de vil bevare ved kontorenboarding.
-- Nullification ved delete er sikrest.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'client_ads_configs'
  ) THEN
    BEGIN
      ALTER TABLE crm_customers
        ADD CONSTRAINT crm_customers_agent_config_fkey
        FOREIGN KEY (agent_config_id)
        REFERENCES client_ads_configs(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN others THEN NULL;
    END;
  END IF;
END$$;

-- Index for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_crm_customers_agent_config
  ON crm_customers(agent_config_id, lead_status)
  WHERE agent_config_id IS NOT NULL;

-- Personlig Marketing Cockpit-rader skal forbli IS NULL — explicit
-- partial index for raskere "Daniel-only"-queries
CREATE INDEX IF NOT EXISTS idx_crm_customers_personal
  ON crm_customers(owner_user_id, updated_at DESC)
  WHERE agent_config_id IS NULL;

-- ── crm_visits + crm_lead_activities arver tenant via customer_id ───
-- Vi trenger ikke duplisere tenant-felter på visits/activities — de
-- joines på crm_customers.agent_config_id når nødvendig.

COMMIT;
