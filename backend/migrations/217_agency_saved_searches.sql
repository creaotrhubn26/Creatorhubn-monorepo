-- Agency Saved Searches — Phase 7 Talent Registry.
--
-- Stella, NSF og produsenter lagrer søke-kriterier for raskere
-- tilbakekomst ("Oslo 25-30 Drama", "Bergen 30+ Nordic look").
-- Filtre lagres som JSONB slik at de matcher search-endpoint-input
-- 1:1 og overlever skjema-endringer i filter-strukturen.
--
-- Eierskap: per user, men agency-medlemmer kan dele via shared_with
-- agency_org_id (alle i samme Stella-byrå ser hverandres lagrede søk).

CREATE TABLE IF NOT EXISTS agency_saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agency_org_id UUID REFERENCES agency_orgs(id) ON DELETE CASCADE,

  name VARCHAR(120) NOT NULL,
  -- filters: {q?, location?, gender?, age_min?, age_max?, languages?,
  --          skills?, dialects?, availability?, has_selftape?, representation?}
  filters JSONB NOT NULL DEFAULT '{}',
  -- estimated_count cachet ved sist kjøring (UI viser "142 talents matched")
  estimated_count INTEGER,
  estimated_at TIMESTAMPTZ,
  -- shared = synlig for alle i agency_org. owner kan endre.
  shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS agency_saved_searches_owner_idx ON agency_saved_searches (owner_user_id);
CREATE INDEX IF NOT EXISTS agency_saved_searches_agency_idx ON agency_saved_searches (agency_org_id) WHERE shared = TRUE;

DROP TRIGGER IF EXISTS update_agency_saved_searches_updated_at ON agency_saved_searches;
CREATE TRIGGER update_agency_saved_searches_updated_at
  BEFORE UPDATE ON agency_saved_searches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
