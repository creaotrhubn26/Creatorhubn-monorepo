-- Canvas persistence hardening.
--
-- The Canvas tables were historically created lazily by the route module.
-- This migration makes the schema reproducible, adds optimistic concurrency,
-- full snapshots, and ownership-preserving document relationships.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('0465_leadgrid_canvas_integrity'));

CREATE TABLE IF NOT EXISTS leadgrid_canvas_notater (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tittel TEXT NOT NULL DEFAULT '',
  kategori TEXT NOT NULL DEFAULT 'mote',
  selskap TEXT,
  lead_id TEXT,
  drawing_base64 TEXT NOT NULL DEFAULT '',
  delt BOOLEAN NOT NULL DEFAULT false,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  stempler TEXT NOT NULL DEFAULT '[]',
  tekstbokser TEXT NOT NULL DEFAULT '[]',
  figurer TEXT NOT NULL DEFAULT '[]',
  papir TEXT NOT NULL DEFAULT 'blank',
  noder TEXT NOT NULL DEFAULT '[]',
  sider INTEGER NOT NULL DEFAULT 1,
  objekter TEXT NOT NULL DEFAULT '[]',
  sokbar_tekst TEXT NOT NULL DEFAULT '',
  dokumenter TEXT NOT NULL DEFAULT '[]',
  revision BIGINT NOT NULL DEFAULT 0,
  slettet_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE leadgrid_canvas_notater
  ADD COLUMN IF NOT EXISTS delt BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS stempler TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS tekstbokser TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS figurer TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS papir TEXT NOT NULL DEFAULT 'blank',
  ADD COLUMN IF NOT EXISTS noder TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sider INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS objekter TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sokbar_tekst TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dokumenter TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS slettet_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leadgrid_canvas_bruker
  ON leadgrid_canvas_notater (organization_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_canvas_trash_expiry
  ON leadgrid_canvas_notater (slettet_at, id)
  WHERE slettet_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_canvas_notat_scope
  ON leadgrid_canvas_notater (id, organization_id, user_id);

CREATE TABLE IF NOT EXISTS leadgrid_canvas_versjoner (
  id UUID PRIMARY KEY,
  notat_id UUID NOT NULL,
  revision BIGINT,
  schema_version SMALLINT NOT NULL DEFAULT 1,
  snapshot JSONB,
  storage_bytes BIGINT,
  kategori TEXT NOT NULL DEFAULT 'mote',
  drawing_base64 TEXT NOT NULL DEFAULT '',
  objekter TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE leadgrid_canvas_versjoner
  ADD COLUMN IF NOT EXISTS revision BIGINT,
  ADD COLUMN IF NOT EXISTS schema_version SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS snapshot JSONB,
  ADD COLUMN IF NOT EXISTS storage_bytes BIGINT;

-- Legacy rows only contain the drawing/category/object subset. Preserve them
-- for display but mark them schema v0 so they can never be mistaken for a
-- complete, safely restorable snapshot.
WITH revision_floor AS (
  SELECT notat_id, LEAST(COALESCE(MIN(revision), 0), 0) AS floor
    FROM leadgrid_canvas_versjoner
   GROUP BY notat_id
), ranked AS (
  SELECT v.ctid,
         f.floor - ROW_NUMBER() OVER (
           PARTITION BY v.notat_id ORDER BY v.created_at, v.id
         ) AS legacy_revision
    FROM leadgrid_canvas_versjoner v
    JOIN revision_floor f ON f.notat_id = v.notat_id
   WHERE v.revision IS NULL
)
UPDATE leadgrid_canvas_versjoner v
   SET revision = ranked.legacy_revision
  FROM ranked
 WHERE v.ctid = ranked.ctid;

UPDATE leadgrid_canvas_versjoner
   SET schema_version = 0,
       snapshot = jsonb_build_object(
         'kategori', kategori,
         'drawing_base64', drawing_base64,
         'objekter', objekter
       )
 WHERE snapshot IS NULL;

UPDATE leadgrid_canvas_versjoner
   SET storage_bytes =
       COALESCE(pg_column_size(snapshot), 0) +
       octet_length(COALESCE(drawing_base64, '')) +
       octet_length(COALESCE(objekter, '')) + 512
 WHERE storage_bytes IS NULL;

ALTER TABLE leadgrid_canvas_versjoner
  ALTER COLUMN revision SET NOT NULL,
  ALTER COLUMN snapshot SET NOT NULL,
  ALTER COLUMN storage_bytes SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_canvas_versjon_revision
  ON leadgrid_canvas_versjoner (notat_id, revision);
CREATE INDEX IF NOT EXISTS idx_canvas_versjoner_notat
  ON leadgrid_canvas_versjoner (notat_id, created_at DESC);

DO $$
BEGIN
  -- NOT VALID deliberately preserves any pre-migration orphan for a later
  -- audited cleanup; PostgreSQL still enforces/cascades the constraint for
  -- every subsequent write and parent delete.
  ALTER TABLE leadgrid_canvas_versjoner
    ADD CONSTRAINT fk_canvas_versjon_notat
    FOREIGN KEY (notat_id) REFERENCES leadgrid_canvas_notater(id)
    ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM leadgrid_canvas_versjoner v
      LEFT JOIN leadgrid_canvas_notater n ON n.id = v.notat_id
     WHERE n.id IS NULL
  ) THEN
    ALTER TABLE leadgrid_canvas_versjoner
      VALIDATE CONSTRAINT fk_canvas_versjon_notat;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS leadgrid_canvas_dokumenter (
  id TEXT PRIMARY KEY,
  notat_id UUID NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  navn TEXT NOT NULL DEFAULT '',
  base64 TEXT NOT NULL DEFAULT '',
  content_sha256 TEXT,
  byte_size BIGINT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE leadgrid_canvas_dokumenter
  ADD COLUMN IF NOT EXISTS content_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS byte_size BIGINT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_canvas_dokumenter_notat
  ON leadgrid_canvas_dokumenter (notat_id);
CREATE INDEX IF NOT EXISTS idx_canvas_dokumenter_scope
  ON leadgrid_canvas_dokumenter (organization_id, user_id, notat_id);

DO $$
BEGIN
  -- Same legacy-orphan policy as versions: no destructive cleanup in this
  -- migration, while all new document writes become scope/FK constrained.
  ALTER TABLE leadgrid_canvas_dokumenter
    ADD CONSTRAINT fk_canvas_dokument_notat_scope
    FOREIGN KEY (notat_id, organization_id, user_id)
    REFERENCES leadgrid_canvas_notater (id, organization_id, user_id)
    ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM leadgrid_canvas_dokumenter d
      LEFT JOIN leadgrid_canvas_notater n
        ON n.id = d.notat_id
       AND n.organization_id = d.organization_id
       AND n.user_id = d.user_id
     WHERE n.id IS NULL
  ) THEN
    ALTER TABLE leadgrid_canvas_dokumenter
      VALIDATE CONSTRAINT fk_canvas_dokument_notat_scope;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS leadgrid_canvas_bibliotek (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  navn TEXT NOT NULL DEFAULT '',
  innhold TEXT NOT NULL DEFAULT '{}',
  delt BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canvas_bibliotek_org
  ON leadgrid_canvas_bibliotek (organization_id);

CREATE TABLE IF NOT EXISTS leadgrid_canvas_policy (
  organization_id TEXT NOT NULL,
  malgruppe TEXT NOT NULL,
  skjulte_funksjoner JSONB NOT NULL DEFAULT '[]',
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, malgruppe)
);

COMMIT;
