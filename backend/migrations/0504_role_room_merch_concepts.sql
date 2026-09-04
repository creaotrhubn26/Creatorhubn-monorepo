-- 0504_role_room_merch_concepts.sql
--
-- Persists the Role Room merch decision flow from brand/logo selection to
-- supplier variant, production specification, provider render and approval.
-- concept_key is a deterministic SHA-256 computed by the application; the
-- project-scoped unique constraint makes repeated saves idempotent.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('0504_role_room_merch_concepts'));

CREATE TABLE IF NOT EXISTS role_room_merch_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  concept_key VARCHAR(64) NOT NULL,
  product_id VARCHAR(32) NOT NULL,
  supplier_key TEXT NOT NULL DEFAULT '',
  supplier_name TEXT,
  provider VARCHAR(32) NOT NULL DEFAULT 'concept',
  provider_product_id INTEGER,
  provider_variant_id INTEGER,
  provider_color_name TEXT,
  provider_color_hex VARCHAR(7),
  requested_color_hex VARCHAR(7) NOT NULL,
  logo_url TEXT NOT NULL,
  logo_variant VARCHAR(16) NOT NULL DEFAULT 'original',
  placement VARCHAR(64) NOT NULL,
  print_width_mm NUMERIC(7,2) NOT NULL,
  print_height_mm NUMERIC(7,2) NOT NULL,
  technique VARCHAR(32) NOT NULL,
  mockup_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  approved_by_user_id TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT role_room_merch_concepts_product_check
    CHECK (product_id IN ('tshirt', 'hoodie', 'polo', 'cap', 'totebag', 'mug')),
  CONSTRAINT role_room_merch_concepts_provider_check
    CHECK (provider IN ('concept', 'printful')),
  CONSTRAINT role_room_merch_concepts_logo_variant_check
    CHECK (logo_variant IN ('original', 'light', 'dark')),
  CONSTRAINT role_room_merch_concepts_status_check
    CHECK (status IN ('draft', 'approved', 'archived')),
  CONSTRAINT role_room_merch_concepts_requested_color_check
    CHECK (requested_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT role_room_merch_concepts_provider_color_check
    CHECK (provider_color_hex IS NULL OR provider_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT role_room_merch_concepts_print_size_check
    CHECK (print_width_mm > 0 AND print_height_mm > 0),
  CONSTRAINT role_room_merch_concepts_key_check
    CHECK (concept_key ~ '^[0-9a-f]{64}$'),
  CONSTRAINT role_room_merch_concepts_logo_url_check
    CHECK (logo_url ~* '^https://'),
  CONSTRAINT role_room_merch_concepts_mockup_urls_check
    CHECK (jsonb_typeof(mockup_urls) = 'array'),
  CONSTRAINT role_room_merch_concepts_printful_metadata_check
    CHECK (
      provider <> 'printful'
      OR (
        provider_product_id IS NOT NULL
        AND provider_variant_id IS NOT NULL
        AND provider_color_hex IS NOT NULL
      )
    ),
  CONSTRAINT role_room_merch_concepts_project_key_unique
    UNIQUE (project_id, concept_key)
);

CREATE INDEX IF NOT EXISTS role_room_merch_concepts_project_updated_idx
  ON role_room_merch_concepts (project_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS role_room_merch_concepts_one_approved_product_idx
  ON role_room_merch_concepts (project_id, product_id)
  WHERE status = 'approved';

ALTER TABLE IF EXISTS role_room_merch_mockup_cache
  ADD COLUMN IF NOT EXISTS mockup_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON TABLE role_room_merch_concepts IS
  'Project-scoped, idempotent merch concepts from logo/palette through production approval.';
COMMENT ON COLUMN role_room_merch_concepts.concept_key IS
  'SHA-256 of normalized production inputs; unique per project to prevent duplicate concepts.';
COMMENT ON COLUMN role_room_merch_concepts.provider_color_hex IS
  'Actual catalog variant color when provider=printful; requested_color_hex remains the brand target.';

COMMIT;
