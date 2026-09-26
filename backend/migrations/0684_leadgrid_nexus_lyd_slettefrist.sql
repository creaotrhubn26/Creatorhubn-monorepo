-- Slettefrist for rå lyd i Nexus (§5 i docs/leadgrid-gdpr-lydopptak.md).
--
-- «Rå lyd slettes automatisk etter 90 dager (konfigurerbart per org, aldri
--  lenger enn 12 mnd). Sletterutine: cron-jobb + logg av hva som ble slettet
--  når (etterprøvbarhet).»
--
-- To ting kreves: en frist å slette etter, og et spor av at det faktisk
-- skjedde. Uten loggen kan vi ikke dokumentere etterlevelse, og da er
-- sletting like ubevisbar som ingen sletting.

ALTER TABLE leadgrid_canvas_dokumenter
  -- Hva slags innhold dette er. Bare lyd og video har slettefrist; en PDF
  -- av et tilbud er ikke en personopplysning på samme måte.
  ADD COLUMN IF NOT EXISTS slag TEXT NOT NULL DEFAULT 'pdf',
  -- Når bytene skal være borte. NULL = ingen frist (PDF-er).
  ADD COLUMN IF NOT EXISTS slettes_etter TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_canvas_dok_slettefrist
  ON leadgrid_canvas_dokumenter (slettes_etter)
  WHERE slettes_etter IS NOT NULL;

-- Etterprøvbarheten. Raden overlever innholdet den beskriver: det er hele
-- poenget — vi må kunne vise HVA som ble slettet NÅR, uten å ha det igjen.
CREATE TABLE IF NOT EXISTS leadgrid_nexus_sletting_logg (
  id              BIGSERIAL PRIMARY KEY,
  dok_id          TEXT NOT NULL,
  notat_id        UUID,
  organization_id TEXT NOT NULL,
  slag            TEXT NOT NULL,
  storrelse_bytes BIGINT,
  opprettet_at    TIMESTAMPTZ,
  slettet_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  grunn           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nexus_sletting_org
  ON leadgrid_nexus_sletting_logg (organization_id, slettet_at DESC);

COMMENT ON TABLE leadgrid_nexus_sletting_logg IS
  'Etterprøvbar logg over slettet rå lyd/video i Nexus. Kreves av GDPR-pakkens §5.';

-- Org-styrt frist, innenfor taket dokumentet setter.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS nexus_lyd_slettefrist_dager INT;

COMMENT ON COLUMN organizations.nexus_lyd_slettefrist_dager IS
  'Dager før rå lyd i Nexus slettes. NULL = 90 (standard). Aldri over 365 — GDPR-pakken §5.';
