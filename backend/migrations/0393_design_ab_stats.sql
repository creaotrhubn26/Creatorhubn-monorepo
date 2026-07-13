-- 0393_design_ab_stats — persistent A/B-analyse for CreatorHub Design.
--
-- Tidligere ble A/B-eksponeringer/konverteringer kun holdt in-memory i backend
-- (nullstilt ved hver restart). Denne tabellen holder aggregerte tellere per
-- (workspace, variant) så tallene overlever deploy/restart. Ikke PII — kun antall.
-- Backend faller tilbake til in-memory hvis tabellen mangler (defensivt).

CREATE TABLE IF NOT EXISTS design_ab_stats (
  workspace   text        NOT NULL,
  variant     text        NOT NULL,
  exposures   bigint      NOT NULL DEFAULT 0,
  conversions bigint      NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace, variant)
);
