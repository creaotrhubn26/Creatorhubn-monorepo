-- 0555_leadgrid_discovery_source_cursor_map.sql
--
-- Per-query Discovery row cursor for a stable BRREG ordering. Each key maps a
-- query universe to the next raw-row offset at the fixed application page size.
-- BRREG offset pages are not a snapshot: upstream changes between runs can
-- still cause repeats or rare skips, which downstream identity dedupe mitigates.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION leadgrid_discovery_source_cursor_map_is_valid(
  cursor_map JSONB
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $validation$
  SELECT CASE
    WHEN jsonb_typeof(cursor_map) = 'object' THEN NOT EXISTS (
      SELECT 1
        FROM jsonb_each(cursor_map) AS entry(key, value)
       WHERE entry.key !~ '^[a-f0-9]{64}$'
          OR NOT CASE
            WHEN jsonb_typeof(entry.value) = 'number'
             AND entry.value::text ~ '^(0|[1-9][0-9]{0,9})$'
            THEN (entry.value::text)::NUMERIC BETWEEN 0 AND 2147483647
            ELSE FALSE
          END
    )
    ELSE FALSE
  END;
$validation$;

ALTER TABLE leadgrid_discovery_profiles
  ADD COLUMN IF NOT EXISTS source_cursor_map JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'leadgrid_discovery_profiles'::regclass
       AND conname = 'leadgrid_discovery_profiles_source_cursor_map_check'
  ) THEN
    ALTER TABLE leadgrid_discovery_profiles
      ADD CONSTRAINT leadgrid_discovery_profiles_source_cursor_map_check
      CHECK (leadgrid_discovery_source_cursor_map_is_valid(source_cursor_map))
      NOT VALID;
  END IF;
END
$constraints$;

ALTER TABLE leadgrid_discovery_profiles
  VALIDATE CONSTRAINT leadgrid_discovery_profiles_source_cursor_map_check;

DO $campaign_constraints$
BEGIN
  IF to_regclass('leadgrid_discovery_campaign_items') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM pg_constraint
        WHERE conrelid = 'leadgrid_discovery_campaign_items'::regclass
          AND conname = 'leadgrid_discovery_campaign_items_cursor_snapshot_check'
     ) THEN
    ALTER TABLE leadgrid_discovery_campaign_items
      ADD CONSTRAINT leadgrid_discovery_campaign_items_cursor_snapshot_check
      CHECK (
        leadgrid_discovery_source_cursor_map_is_valid(source_cursor_map_snapshot)
      ) NOT VALID;
  END IF;
END
$campaign_constraints$;

ALTER TABLE leadgrid_discovery_campaign_items
  VALIDATE CONSTRAINT leadgrid_discovery_campaign_items_cursor_snapshot_check;

COMMENT ON COLUMN leadgrid_discovery_profiles.source_cursor_map IS
  'SHA-256 query fingerprint to next absolute BRREG raw-row offset. Legacy rotation_index is deliberately not converted because uncertain conversion could skip candidates.';

COMMIT;
