-- Keep setup-template plans aligned with plan_limits before self-onboarding
-- starts enforcing the relationship fail closed.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtext('0462_org_setup_template_plan_integrity'));

UPDATE organization_setup_templates
   SET default_plan = 'solo_free',
       updated_at = NOW()
 WHERE template_key IN ('solo', 'healthtech')
   AND default_plan IN ('free', 'solo');

UPDATE organizations
   SET plan = 'solo_free'
 WHERE plan IN ('free', 'solo')
   AND stripe_subscription_id IS NULL;

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

-- Mapping runs first, then the constraint is validated in the same
-- transaction. A previously unknown plan key must stop rollout instead of
-- leaving a permanently NOT VALID tenant contract behind.
ALTER TABLE organization_setup_templates
  VALIDATE CONSTRAINT org_setup_templates_default_plan_fk;

COMMIT;
