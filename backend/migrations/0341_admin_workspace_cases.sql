-- 0341_admin_workspace_cases.sql
--
-- «Saker»-modul for AdminWorkspace (Notion+Slack-stil intern flate, kun
-- daniel@creatorhubn.com per i dag).
--
-- En sak er en lett tråd som Daniel åpner når han skal følge opp noe:
--   • «lead-X må ringes torsdag»
--   • «kunde-Y er misfornøyd med fakturaen»
--   • «intern: Stripe-Connect-test må gjøres»
--
-- En sak kan kobles (men trenger ikke) til en lead/kunde, partner,
-- investor, outreach-template eller funding-app. Hvert kob skjer via
-- en lett polymorf referanse (linked_entity_type + linked_entity_id) —
-- ingen FK på dette i MVP, fordi entiteten kan slettes uten å miste
-- saken (vi vil heller ha en "død referanse"-warning enn cascade-tap).
--
-- Multi-produkt:
--   product_key NULL   → intern sak (uten produkt-tilhørighet)
--   product_key 'role_room' eller 'leadgrid' → produkt-spesifikk sak
--
-- Idempotent: alt med IF NOT EXISTS / DO $$ pg_constraint-sjekk.

------------------------------------------------------------
-- 1) admin_workspace_cases — selve sak-tråden
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_workspace_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  product_key VARCHAR(20) DEFAULT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  priority VARCHAR(10) NOT NULL DEFAULT 'normal',
  due_date DATE,
  linked_entity_type VARCHAR(40),
  linked_entity_id VARCHAR,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by VARCHAR
);

-- Status whitelist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_workspace_cases_status_check'
  ) THEN
    ALTER TABLE admin_workspace_cases
      ADD CONSTRAINT admin_workspace_cases_status_check
      CHECK (status IN ('open','in_progress','blocked','done','archived'));
  END IF;
END$$;

-- Priority whitelist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_workspace_cases_priority_check'
  ) THEN
    ALTER TABLE admin_workspace_cases
      ADD CONSTRAINT admin_workspace_cases_priority_check
      CHECK (priority IN ('low','normal','high','urgent'));
  END IF;
END$$;

-- product_key whitelist (NULL = intern, ellers role_room | leadgrid)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_workspace_cases_product_key_check'
  ) THEN
    ALTER TABLE admin_workspace_cases
      ADD CONSTRAINT admin_workspace_cases_product_key_check
      CHECK (product_key IS NULL OR product_key IN ('role_room', 'leadgrid'));
  END IF;
END$$;

-- linked_entity_type whitelist (NULL = ingen kobling)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_workspace_cases_linked_entity_type_check'
  ) THEN
    ALTER TABLE admin_workspace_cases
      ADD CONSTRAINT admin_workspace_cases_linked_entity_type_check
      CHECK (
        linked_entity_type IS NULL
        OR linked_entity_type IN ('customer', 'partner', 'investor', 'outreach_template', 'funding_app')
      );
  END IF;
END$$;

-- Indekser
CREATE INDEX IF NOT EXISTS idx_admin_workspace_cases_user_status_due
  ON admin_workspace_cases (user_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_cases_user_product
  ON admin_workspace_cases (user_id, product_key);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_cases_linked_entity
  ON admin_workspace_cases (linked_entity_type, linked_entity_id);

------------------------------------------------------------
-- 2) admin_workspace_case_comments — tråd-kommentarer
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_workspace_case_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES admin_workspace_cases(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_case_comments_case_created
  ON admin_workspace_case_comments (case_id, created_at);

------------------------------------------------------------
-- 3) Kommentarer
------------------------------------------------------------
COMMENT ON TABLE admin_workspace_cases IS
  'Saker / oppfølgings-tråder i AdminWorkspace. En lett-vekt sak-tråd som Daniel åpner for å følge opp leads, kunder, partnere, investorer, outreach-templates eller funding-apps — eller bare for en intern påminnelse.';

COMMENT ON COLUMN admin_workspace_cases.product_key IS
  'NULL = intern sak (uten produkt-tilhørighet). Ellers ''role_room'' eller ''leadgrid''. Frontend produkt-filter respekterer dette.';

COMMENT ON COLUMN admin_workspace_cases.linked_entity_type IS
  'Polymorf referanse-type. Ingen FK — saken overlever om referert entitet slettes.';

COMMENT ON TABLE admin_workspace_case_comments IS
  'Kommentar-tråd til en sak. CASCADE-slettes med sak.';
