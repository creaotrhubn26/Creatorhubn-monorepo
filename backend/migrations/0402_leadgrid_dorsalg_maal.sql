-- =====================================================================
-- mig 0402 — Leadgrid Dørsalg: dagsmål + budsjett per selger
--
-- Salgssjef/teamleder setter hvor mange salg per dag en selger skal nå
-- (dagsmål — driver «X av 3»-milepælen + gull-feiringen på kartet) og
-- et valgfritt kr-budsjett per selger. Kan settes org-bredt (default)
-- ELLER per team; en selgers mål resolves team-først, deretter org.
--
-- Tabell (1):
--   leadgrid_dorsalg_maal — (organization_id, team_id) → mål/budsjett.
--     team_id = '' betyr org-bredt default (PK krever NOT NULL, så vi
--     bruker tom streng i stedet for NULL — unngår partial-unique-kunst).
--
-- Konvensjoner (speiler mig 0361/0397-0401):
--   • organization_id = VARCHAR(255) UTEN FK (resolveOrgIdForUser gir
--     UUID-er, slugs og user-ids om hverandre).
--   • team_id refererer leadgrid_sales_teams.id (klient-generert TEXT),
--     men UTEN FK — team kan slettes uten å felle mål-raden (den blir
--     bare foreldreløs og ignoreres av resolveren).
--   • Idempotent — IF NOT EXISTS, trygg å kjøre 2 ganger.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS leadgrid_dorsalg_maal (
  org_id              VARCHAR(255) NOT NULL,
  -- '' = org-bredt default; ellers leadgrid_sales_teams.id
  team_id             TEXT NOT NULL DEFAULT '',
  -- Salg per dag en selger skal nå (0 = av → ingen milepæl-feiring).
  dagsmal_per_selger  INTEGER NOT NULL DEFAULT 3
                      CHECK (dagsmal_per_selger >= 0 AND dagsmal_per_selger <= 100),
  -- Valgfritt kr-budsjett per selger per dag (NULL = ikke satt).
  budsjett_per_selger INTEGER
                      CHECK (budsjett_per_selger IS NULL OR budsjett_per_selger >= 0),
  updated_by          VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_dorsalg_maal_org
  ON leadgrid_dorsalg_maal(org_id);

COMMIT;
