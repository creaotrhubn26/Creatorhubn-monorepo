-- Migration 233: gdpr_deletion_audit
--
-- Audit-logg for right-to-erasure-flyten (GDPR Art 17). Hver gang
-- en fotograf sletter klient-filer fra B2 via Creatorhub, lagrer
-- vi en rad her som bevis på samsvar. Kreves av Datatilsynet ved
-- inspeksjon — kan brukes til å demonstrere at vi faktisk reagerer
-- på sletteforespørsler.

CREATE TABLE IF NOT EXISTS gdpr_deletion_audit (
  id bigserial PRIMARY KEY,
  user_id varchar NOT NULL,
  project_id varchar NOT NULL,
  provider_id varchar NOT NULL,
  file_name text NOT NULL,
  file_id varchar,
  reason text,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gdpr_deletion_audit_user_idx
  ON gdpr_deletion_audit (user_id, deleted_at DESC);
CREATE INDEX IF NOT EXISTS gdpr_deletion_audit_project_idx
  ON gdpr_deletion_audit (project_id, deleted_at DESC);
