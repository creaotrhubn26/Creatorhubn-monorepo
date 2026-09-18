-- 0462_org_setup_template_plan_integrity.sql
--
-- Retter legacy seed-planer og hindrer at nye oppsettsmaler peker på en
-- plan_key som ikke finnes. Constrainten legges til NOT VALID med vilje:
-- nye INSERT/UPDATE håndheves umiddelbart, mens en eventuell ukjent historisk
-- rad ikke gjør denne sikkerhetsmigrasjonen udeployerbar. Self-onboarding
-- validerer i tillegg at planen er aktiv og feiler lukket ved avvik.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtext('0462_org_setup_template_plan_integrity'));

UPDATE organization_setup_templates
   SET default_plan = 'solo_free',
       updated_at = now()
 WHERE template_key IN ('solo', 'healthtech')
   AND default_plan IN ('free', 'solo');

-- 0312 gjorde samme konvertering én gang, men den daværende offentlige
-- onboarding-ruten fortsatte senere å opprette nye orgs med legacy-planen
-- `solo`. Reparer alle ikke-betalende legacy-rader på nytt.
UPDATE organizations
   SET plan = 'solo_free'
 WHERE plan IN ('free', 'solo')
   AND stripe_subscription_id IS NULL;

-- En legacy `solo` med Stripe-subscription var den betalte Solo-planen. Den
-- må mappes til dagens `solo_pro`; ellers vil fail-closed planoppslag sperre
-- en betalende organisasjon etter denne hardeningen.
UPDATE organizations
   SET plan = 'solo_pro'
 WHERE plan = 'solo'
   AND stripe_subscription_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'org_setup_templates_default_plan_fk'
       AND conrelid = 'organization_setup_templates'::regclass
  ) THEN
    ALTER TABLE organization_setup_templates
      ADD CONSTRAINT org_setup_templates_default_plan_fk
      FOREIGN KEY (default_plan)
      REFERENCES plan_limits(plan_key)
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

-- Mappingen over dekker alle kjente legacy-planer. Valider i samme
-- transaksjon slik at en ukjent planverdi stopper utrullingen i stedet for å
-- etterlate tenant-kontrakten permanent NOT VALID.
ALTER TABLE organization_setup_templates
  VALIDATE CONSTRAINT org_setup_templates_default_plan_fk;

COMMIT;
