-- Bind every persisted Dorsalg fact to one authoritative Leadgrid customer project.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '180s';

ALTER TABLE leadgrid_dorsalg_products ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_dorsalg_product_access ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_dorsalg_status ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_dorsalg_sales ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_dorsalg_maal ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_dorsalg_products ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE leadgrid_dorsalg_sales ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

WITH single_project AS (
  SELECT organization_id::text AS org_id, MIN(id) AS project_id
   FROM leadgrid_projects
  WHERE organization_id IS NOT NULL
  GROUP BY organization_id
  HAVING COUNT(*) = 1
     AND BOOL_AND(
       (status IS NULL OR status NOT IN ('archived', 'deleted'))
       AND (project_type IS NULL OR project_type NOT IN (
         'feature_film', 'documentary', 'film', 'short_film',
         'tv_series', 'commercial', 'music_video', 'casting'
       ))
     )
)
UPDATE leadgrid_dorsalg_products AS target
   SET project_id = one.project_id
  FROM single_project one
 WHERE target.project_id IS NULL AND target.org_id = one.org_id;

WITH single_project AS (
  SELECT organization_id::text AS org_id, MIN(id) AS project_id
   FROM leadgrid_projects
  WHERE organization_id IS NOT NULL
   GROUP BY organization_id
  HAVING COUNT(*) = 1
     AND BOOL_AND(
       (status IS NULL OR status NOT IN ('archived', 'deleted'))
       AND (project_type IS NULL OR project_type NOT IN (
         'feature_film', 'documentary', 'film', 'short_film',
         'tv_series', 'commercial', 'music_video', 'casting'
       ))
     )
)
UPDATE leadgrid_dorsalg_status AS target SET project_id = one.project_id
  FROM single_project one
 WHERE target.project_id IS NULL AND target.org_id = one.org_id;

WITH single_project AS (
  SELECT organization_id::text AS org_id, MIN(id) AS project_id
   FROM leadgrid_projects
  WHERE organization_id IS NOT NULL
   GROUP BY organization_id
  HAVING COUNT(*) = 1
     AND BOOL_AND(
       (status IS NULL OR status NOT IN ('archived', 'deleted'))
       AND (project_type IS NULL OR project_type NOT IN (
         'feature_film', 'documentary', 'film', 'short_film',
         'tv_series', 'commercial', 'music_video', 'casting'
       ))
     )
)
UPDATE leadgrid_dorsalg_sales AS target SET project_id = one.project_id
  FROM single_project one
 WHERE target.project_id IS NULL AND target.org_id = one.org_id;

WITH single_project AS (
  SELECT organization_id::text AS org_id, MIN(id) AS project_id
   FROM leadgrid_projects
  WHERE organization_id IS NOT NULL
   GROUP BY organization_id
  HAVING COUNT(*) = 1
     AND BOOL_AND(
       (status IS NULL OR status NOT IN ('archived', 'deleted'))
       AND (project_type IS NULL OR project_type NOT IN (
         'feature_film', 'documentary', 'film', 'short_film',
         'tv_series', 'commercial', 'music_video', 'casting'
       ))
     )
)
UPDATE leadgrid_dorsalg_maal AS target SET project_id = one.project_id
  FROM single_project one
 WHERE target.project_id IS NULL AND target.org_id = one.org_id;

WITH verification_scope AS (
  SELECT verification.organization_id AS org_id,
         SUBSTRING(verification.customer_id FROM CHAR_LENGTH('dorsalg:') + 1) AS adresse_id,
         MIN(verification.project_id) AS project_id
    FROM leadgrid_sales_verifications verification
    JOIN leadgrid_projects project
      ON project.id = verification.project_id
     AND project.organization_id::text = verification.organization_id
     AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
     AND (project.project_type IS NULL OR project.project_type NOT IN (
       'feature_film', 'documentary', 'film', 'short_film',
       'tv_series', 'commercial', 'music_video', 'casting'
     ))
   WHERE verification.project_id IS NOT NULL
     AND verification.customer_id LIKE 'dorsalg:%'
     AND verification.customer_id NOT LIKE 'dorsalg-sale:%'
   GROUP BY verification.organization_id,
            SUBSTRING(verification.customer_id FROM CHAR_LENGTH('dorsalg:') + 1)
  HAVING COUNT(DISTINCT verification.project_id) = 1
)
UPDATE leadgrid_dorsalg_status AS target SET project_id = evidence.project_id
  FROM verification_scope evidence
 WHERE target.project_id IS NULL
   AND target.org_id = evidence.org_id
   AND target.adresse_id = evidence.adresse_id;

WITH verification_scope AS (
  SELECT verification.organization_id AS org_id,
         SUBSTRING(verification.customer_id FROM CHAR_LENGTH('dorsalg:') + 1) AS adresse_id,
         MIN(verification.project_id) AS project_id
    FROM leadgrid_sales_verifications verification
    JOIN leadgrid_projects project
      ON project.id = verification.project_id
     AND project.organization_id::text = verification.organization_id
     AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
     AND (project.project_type IS NULL OR project.project_type NOT IN (
       'feature_film', 'documentary', 'film', 'short_film',
       'tv_series', 'commercial', 'music_video', 'casting'
     ))
   WHERE verification.project_id IS NOT NULL
     AND verification.customer_id LIKE 'dorsalg:%'
     AND verification.customer_id NOT LIKE 'dorsalg-sale:%'
   GROUP BY verification.organization_id,
            SUBSTRING(verification.customer_id FROM CHAR_LENGTH('dorsalg:') + 1)
  HAVING COUNT(DISTINCT verification.project_id) = 1
)
UPDATE leadgrid_dorsalg_sales AS target SET project_id = evidence.project_id
  FROM verification_scope evidence
 WHERE target.project_id IS NULL
   AND target.org_id = evidence.org_id
   AND target.adresse_id = evidence.adresse_id;

WITH product_scope AS (
  SELECT org_id, product_id, MIN(project_id) AS project_id
    FROM (
      SELECT org_id, product_id, project_id FROM leadgrid_dorsalg_status
       WHERE product_id IS NOT NULL AND project_id IS NOT NULL
      UNION ALL
      SELECT org_id, product_id, project_id FROM leadgrid_dorsalg_sales
       WHERE product_id IS NOT NULL AND project_id IS NOT NULL
    ) resolved
   GROUP BY org_id, product_id
  HAVING COUNT(DISTINCT project_id) = 1
)
UPDATE leadgrid_dorsalg_products AS product SET project_id = scope.project_id
  FROM product_scope scope
 WHERE product.project_id IS NULL
   AND product.org_id = scope.org_id AND product.id = scope.product_id;

UPDATE leadgrid_dorsalg_status AS target SET project_id = product.project_id
  FROM leadgrid_dorsalg_products product
 WHERE target.project_id IS NULL AND product.project_id IS NOT NULL
   AND target.org_id = product.org_id AND target.product_id = product.id;
UPDATE leadgrid_dorsalg_sales AS target SET project_id = product.project_id
  FROM leadgrid_dorsalg_products product
 WHERE target.project_id IS NULL AND product.project_id IS NOT NULL
   AND target.org_id = product.org_id AND target.product_id = product.id;
UPDATE leadgrid_dorsalg_product_access AS target SET project_id = product.project_id
  FROM leadgrid_dorsalg_products product
 WHERE target.project_id IS NULL AND product.project_id IS NOT NULL
   AND target.org_id = product.org_id AND target.product_id = product.id;

WITH address_scope AS (
  SELECT org_id, adresse_id, MIN(project_id) AS project_id
    FROM (
      SELECT org_id, adresse_id, project_id FROM leadgrid_dorsalg_status WHERE project_id IS NOT NULL
      UNION ALL
      SELECT org_id, adresse_id, project_id FROM leadgrid_dorsalg_sales WHERE project_id IS NOT NULL
    ) resolved
   GROUP BY org_id, adresse_id HAVING COUNT(DISTINCT project_id) = 1
)
UPDATE leadgrid_dorsalg_status AS target SET project_id = scope.project_id
  FROM address_scope scope
 WHERE target.project_id IS NULL AND target.org_id = scope.org_id AND target.adresse_id = scope.adresse_id;

WITH address_scope AS (
  SELECT org_id, adresse_id, MIN(project_id) AS project_id
    FROM (
      SELECT org_id, adresse_id, project_id FROM leadgrid_dorsalg_status WHERE project_id IS NOT NULL
      UNION ALL
      SELECT org_id, adresse_id, project_id FROM leadgrid_dorsalg_sales WHERE project_id IS NOT NULL
    ) resolved
   GROUP BY org_id, adresse_id HAVING COUNT(DISTINCT project_id) = 1
)
UPDATE leadgrid_dorsalg_sales AS target SET project_id = scope.project_id
  FROM address_scope scope
 WHERE target.project_id IS NULL AND target.org_id = scope.org_id AND target.adresse_id = scope.adresse_id;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM (
        SELECT org_id, project_id FROM leadgrid_dorsalg_products
        UNION ALL SELECT org_id, project_id FROM leadgrid_dorsalg_product_access
        UNION ALL SELECT org_id, project_id FROM leadgrid_dorsalg_status
        UNION ALL SELECT org_id, project_id FROM leadgrid_dorsalg_sales
        UNION ALL SELECT org_id, project_id FROM leadgrid_dorsalg_maal
      ) scoped
      LEFT JOIN leadgrid_projects project ON project.id = scoped.project_id
     WHERE scoped.project_id IS NOT NULL
       AND (
         project.id IS NULL
         OR project.organization_id::text IS DISTINCT FROM scoped.org_id
         OR project.status IN ('archived', 'deleted')
         OR project.project_type IN (
           'feature_film', 'documentary', 'film', 'short_film',
           'tv_series', 'commercial', 'music_video', 'casting'
         )
       )
  ) THEN
    RAISE EXCEPTION '0552: a scoped Dorsalg row has an invalid organization/project tuple';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM (
        SELECT org_id, project_id, product_id
          FROM leadgrid_dorsalg_product_access
         WHERE project_id IS NOT NULL AND product_id IS NOT NULL
        UNION ALL
        SELECT org_id, project_id, product_id
          FROM leadgrid_dorsalg_status
         WHERE project_id IS NOT NULL AND product_id IS NOT NULL
        UNION ALL
        SELECT org_id, project_id, product_id
          FROM leadgrid_dorsalg_sales
         WHERE project_id IS NOT NULL AND product_id IS NOT NULL
      ) child
      LEFT JOIN leadgrid_dorsalg_products product
        ON product.org_id = child.org_id
       AND product.project_id = child.project_id
       AND product.id = child.product_id
     WHERE product.id IS NULL
  ) THEN
    RAISE EXCEPTION '0552: a scoped Dorsalg child references a product outside its project';
  END IF;
END
$migration$;

ALTER TABLE leadgrid_dorsalg_status
  DROP CONSTRAINT IF EXISTS leadgrid_dorsalg_status_pkey;
ALTER TABLE leadgrid_dorsalg_product_access
  DROP CONSTRAINT IF EXISTS leadgrid_dorsalg_product_access_pkey;
ALTER TABLE leadgrid_dorsalg_maal
  DROP CONSTRAINT IF EXISTS leadgrid_dorsalg_maal_pkey;

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_products_org_project_id_key') THEN
    ALTER TABLE leadgrid_dorsalg_products
      ADD CONSTRAINT leadgrid_dorsalg_products_org_project_id_key
      UNIQUE (org_id, project_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_status_org_project_address_key') THEN
    ALTER TABLE leadgrid_dorsalg_status
      ADD CONSTRAINT leadgrid_dorsalg_status_org_project_address_key
      UNIQUE (org_id, project_id, adresse_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_product_access_org_project_user_product_key') THEN
    ALTER TABLE leadgrid_dorsalg_product_access
      ADD CONSTRAINT leadgrid_dorsalg_product_access_org_project_user_product_key
      UNIQUE (org_id, project_id, user_id, product_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_sales_org_project_id_key') THEN
    ALTER TABLE leadgrid_dorsalg_sales
      ADD CONSTRAINT leadgrid_dorsalg_sales_org_project_id_key
      UNIQUE (org_id, project_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_maal_org_project_team_key') THEN
    ALTER TABLE leadgrid_dorsalg_maal
      ADD CONSTRAINT leadgrid_dorsalg_maal_org_project_team_key
      UNIQUE (org_id, project_id, team_id);
  END IF;
END
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leadgrid_dorsalg_status_legacy_scope
  ON leadgrid_dorsalg_status (org_id, adresse_id)
  WHERE project_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leadgrid_dorsalg_access_legacy_scope
  ON leadgrid_dorsalg_product_access (org_id, user_id, product_id)
  WHERE project_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leadgrid_dorsalg_maal_legacy_scope
  ON leadgrid_dorsalg_maal (org_id, team_id)
  WHERE project_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leadgrid_dorsalg_products_idempotency
  ON leadgrid_dorsalg_products (org_id, project_id, idempotency_key)
  WHERE project_id IS NOT NULL AND idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leadgrid_dorsalg_sales_idempotency
  ON leadgrid_dorsalg_sales (org_id, project_id, idempotency_key)
  WHERE project_id IS NOT NULL AND idempotency_key IS NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_products_project_required_check') THEN
    ALTER TABLE leadgrid_dorsalg_products
      ADD CONSTRAINT leadgrid_dorsalg_products_project_required_check
      CHECK (project_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_product_access_project_required_check') THEN
    ALTER TABLE leadgrid_dorsalg_product_access
      ADD CONSTRAINT leadgrid_dorsalg_product_access_project_required_check
      CHECK (project_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_status_project_required_check') THEN
    ALTER TABLE leadgrid_dorsalg_status
      ADD CONSTRAINT leadgrid_dorsalg_status_project_required_check
      CHECK (project_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_sales_project_required_check') THEN
    ALTER TABLE leadgrid_dorsalg_sales
      ADD CONSTRAINT leadgrid_dorsalg_sales_project_required_check
      CHECK (project_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_maal_project_required_check') THEN
    ALTER TABLE leadgrid_dorsalg_maal
      ADD CONSTRAINT leadgrid_dorsalg_maal_project_required_check
      CHECK (project_id IS NOT NULL) NOT VALID;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_products_project_fk') THEN
    ALTER TABLE leadgrid_dorsalg_products
      ADD CONSTRAINT leadgrid_dorsalg_products_project_fk
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_product_access_project_fk') THEN
    ALTER TABLE leadgrid_dorsalg_product_access
      ADD CONSTRAINT leadgrid_dorsalg_product_access_project_fk
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_status_project_fk') THEN
    ALTER TABLE leadgrid_dorsalg_status
      ADD CONSTRAINT leadgrid_dorsalg_status_project_fk
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_sales_project_fk') THEN
    ALTER TABLE leadgrid_dorsalg_sales
      ADD CONSTRAINT leadgrid_dorsalg_sales_project_fk
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_maal_project_fk') THEN
    ALTER TABLE leadgrid_dorsalg_maal
      ADD CONSTRAINT leadgrid_dorsalg_maal_project_fk
      FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_access_product_scope_fk') THEN
    ALTER TABLE leadgrid_dorsalg_product_access
      ADD CONSTRAINT leadgrid_dorsalg_access_product_scope_fk
      FOREIGN KEY (org_id, project_id, product_id)
      REFERENCES leadgrid_dorsalg_products (org_id, project_id, id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_status_product_scope_fk') THEN
    ALTER TABLE leadgrid_dorsalg_status
      ADD CONSTRAINT leadgrid_dorsalg_status_product_scope_fk
      FOREIGN KEY (org_id, project_id, product_id)
      REFERENCES leadgrid_dorsalg_products (org_id, project_id, id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leadgrid_dorsalg_sales_product_scope_fk') THEN
    ALTER TABLE leadgrid_dorsalg_sales
      ADD CONSTRAINT leadgrid_dorsalg_sales_product_scope_fk
      FOREIGN KEY (org_id, project_id, product_id)
      REFERENCES leadgrid_dorsalg_products (org_id, project_id, id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
END
$migration$;

DROP INDEX IF EXISTS idx_dorsalg_products_org;
DROP INDEX IF EXISTS idx_leadgrid_dorsalg_status_org;
DROP INDEX IF EXISTS idx_dorsalg_sales_org;
DROP INDEX IF EXISTS idx_dorsalg_sales_adresse;
DROP INDEX IF EXISTS idx_leadgrid_dorsalg_maal_org;

CREATE INDEX IF NOT EXISTS idx_leadgrid_dorsalg_products_project_active
  ON leadgrid_dorsalg_products (org_id, project_id, aktiv, sort);
CREATE INDEX IF NOT EXISTS idx_leadgrid_dorsalg_access_project_user
  ON leadgrid_dorsalg_product_access (org_id, project_id, user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_leadgrid_dorsalg_status_project_user_updated
  ON leadgrid_dorsalg_status (org_id, project_id, set_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leadgrid_dorsalg_sales_project_user_created
  ON leadgrid_dorsalg_sales (org_id, project_id, seller_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leadgrid_dorsalg_sales_project_address
  ON leadgrid_dorsalg_sales (org_id, project_id, adresse_id);
-- Salgsledelse-konkurranser er eksplisitt organisasjonsomfattende. Denne
-- partial-indeksen støtter autoriserte rollups på tvers av prosjekter uten å
-- trekke inn uavklarte legacy-rader som 0552 lot stå i karantene.
CREATE INDEX IF NOT EXISTS idx_leadgrid_dorsalg_sales_org_rollup_created
  ON leadgrid_dorsalg_sales (org_id, created_at DESC, seller_user_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leadgrid_dorsalg_maal_project_team
  ON leadgrid_dorsalg_maal (org_id, project_id, team_id);

CREATE OR REPLACE FUNCTION leadgrid_enforce_dorsalg_project_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  project_org_id TEXT;
BEGIN
  IF NEW.project_id IS NULL THEN
    RAISE EXCEPTION '% requires project_id', TG_TABLE_NAME
      USING ERRCODE = '23514';
  END IF;

  SELECT project.organization_id::text
    INTO project_org_id
    FROM leadgrid_projects project
   WHERE project.id = NEW.project_id
     AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
     AND (project.project_type IS NULL OR project.project_type NOT IN (
       'feature_film', 'documentary', 'film', 'short_film',
       'tv_series', 'commercial', 'music_video', 'casting'
     ))
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project % does not exist or is inactive', NEW.project_id
      USING ERRCODE = '23503';
  END IF;
  IF NEW.org_id IS DISTINCT FROM project_org_id THEN
    RAISE EXCEPTION 'organization % does not own project %', NEW.org_id, NEW.project_id
      USING ERRCODE = '23514';
  END IF;

  -- Keep these checks in nested table-specific branches. PostgreSQL must not
  -- resolve a NEW field that does not exist on another trigger row type.
  IF TG_TABLE_NAME = 'leadgrid_dorsalg_product_access' THEN
    PERFORM 1
      FROM leadgrid_dorsalg_products product
     WHERE product.org_id = NEW.org_id
       AND product.project_id = NEW.project_id
       AND product.id = NEW.product_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'product % is not in project %', NEW.product_id, NEW.project_id
        USING ERRCODE = '23503';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM leadgrid_project_members member
       WHERE member.organization_id::text = NEW.org_id
         AND member.project_id = NEW.project_id
         AND member.user_id::text = NEW.user_id::text
    ) AND NOT EXISTS (
      SELECT 1
        FROM leadgrid_projects project
       WHERE project.organization_id::text = NEW.org_id
         AND project.id = NEW.project_id
         AND project.created_by::text = NEW.user_id::text
    ) THEN
      RAISE EXCEPTION 'user % is not a member of project %', NEW.user_id, NEW.project_id
        USING ERRCODE = '23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'leadgrid_dorsalg_status' THEN
    IF NEW.product_id IS NOT NULL THEN
      PERFORM 1
        FROM leadgrid_dorsalg_products product
       WHERE product.org_id = NEW.org_id
         AND product.project_id = NEW.project_id
         AND product.id = NEW.product_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'product % is not in project %', NEW.product_id, NEW.project_id
          USING ERRCODE = '23503';
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'leadgrid_dorsalg_sales' THEN
    IF NEW.product_id IS NOT NULL THEN
      PERFORM 1
        FROM leadgrid_dorsalg_products product
       WHERE product.org_id = NEW.org_id
         AND product.project_id = NEW.project_id
         AND product.id = NEW.product_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'product % is not in project %', NEW.product_id, NEW.project_id
          USING ERRCODE = '23503';
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'leadgrid_dorsalg_maal' THEN
    IF NULLIF(BTRIM(NEW.team_id), '') IS NOT NULL THEN
      PERFORM 1
        FROM leadgrid_sales_teams team
       WHERE team.id::text = NEW.team_id
         AND team.organization_id::text = NEW.org_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'team % is not in organization %', NEW.team_id, NEW.org_id
          USING ERRCODE = '23503';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS leadgrid_dorsalg_products_project_scope
  ON leadgrid_dorsalg_products;
CREATE TRIGGER leadgrid_dorsalg_products_project_scope
  BEFORE INSERT OR UPDATE OF org_id, project_id
  ON leadgrid_dorsalg_products
  FOR EACH ROW EXECUTE FUNCTION leadgrid_enforce_dorsalg_project_scope();

DROP TRIGGER IF EXISTS leadgrid_dorsalg_access_project_scope
  ON leadgrid_dorsalg_product_access;
CREATE TRIGGER leadgrid_dorsalg_access_project_scope
  BEFORE INSERT OR UPDATE OF org_id, project_id, user_id, product_id
  ON leadgrid_dorsalg_product_access
  FOR EACH ROW EXECUTE FUNCTION leadgrid_enforce_dorsalg_project_scope();

DROP TRIGGER IF EXISTS leadgrid_dorsalg_status_project_scope
  ON leadgrid_dorsalg_status;
CREATE TRIGGER leadgrid_dorsalg_status_project_scope
  BEFORE INSERT OR UPDATE OF org_id, project_id, product_id
  ON leadgrid_dorsalg_status
  FOR EACH ROW EXECUTE FUNCTION leadgrid_enforce_dorsalg_project_scope();

DROP TRIGGER IF EXISTS leadgrid_dorsalg_sales_project_scope
  ON leadgrid_dorsalg_sales;
CREATE TRIGGER leadgrid_dorsalg_sales_project_scope
  BEFORE INSERT OR UPDATE OF org_id, project_id, product_id
  ON leadgrid_dorsalg_sales
  FOR EACH ROW EXECUTE FUNCTION leadgrid_enforce_dorsalg_project_scope();

DROP TRIGGER IF EXISTS leadgrid_dorsalg_maal_project_scope
  ON leadgrid_dorsalg_maal;
CREATE TRIGGER leadgrid_dorsalg_maal_project_scope
  BEFORE INSERT OR UPDATE OF org_id, project_id, team_id
  ON leadgrid_dorsalg_maal
  FOR EACH ROW EXECUTE FUNCTION leadgrid_enforce_dorsalg_project_scope();

COMMENT ON FUNCTION leadgrid_enforce_dorsalg_project_scope() IS
  'Rejects cross-project Dorsalg writes while unresolved legacy rows remain quarantined by NOT VALID constraints.';

COMMIT;
