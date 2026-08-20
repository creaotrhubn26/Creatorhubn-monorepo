-- 0446: Selgerorgens egen NACE-kode (2026-08-19)
--
-- Leadgrids lead-discovery (Market Scan / Continuous Discovery) hadde et
-- reelt ICP-utledningssystem (ICP_RULES + Claude-fallback), men kun basert
-- på støyende nettside-skann-tekst — selgerorgens EGEN bransje (fra Brreg,
-- samme kilde som lead-oppslaget bruker) var aldri lagret noe sted i det
-- hele tatt. Kolonnene fylles best-effort lazy i
-- leadgrid-project-lead-discovery-routes.ts (loadProjectContext) via
-- lookupCompanyForNewLead() når org_number finnes men nace_code mangler —
-- ingen egen backfill-jobb nødvendig.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS nace_code VARCHAR(16);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS nace_description TEXT;
