-- 0091_projects_client_id.sql
-- Photographer e2e: kobler projects-tabellen til canonical clients-tabellen
-- slik at /api/photographer/projects kan listes opp med klient-info uten
-- å gjette på fritekst i clientName-feltet.
--
-- Eksisterende clientName beholdes som fallback for prosjekter laget før
-- denne migrasjonen og for prosjekter med klient som ikke er i CRM.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_id UUID;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS service_price NUMERIC(10,2);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS cost_overhead NUMERIC(10,2) DEFAULT 0;

-- MVA-sats per prosjekt (norsk standard 25% for fotografering).
-- Lagres som NUMERIC(5,2) for å støtte 12.0 (rom/transport) og 0.0
-- (eksport/utlandet) ved spesielle oppdrag.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 25.00;

-- Ekstern faktura-kobling (PowerOffice / Tripletex / Fiken). Settes når
-- en faktura er opprettet i regnskap, slik at vi unngår dobbel-fakturering.
-- invoice_provider lar oss støtte flere regnskapssystemer samtidig.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS invoice_provider VARCHAR(32);
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS external_invoice_id VARCHAR(64);
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS external_invoice_number VARCHAR(64);
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

-- Google Calendar-event for event_date-sync. NULL hvis event ikke
-- er pushet (enten manglet token eller event_date ble fjernet senere).
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS google_calendar_event_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS projects_client_id_idx ON projects (client_id);

-- Kobler photographer_client_galleries til prosjekt slik at detalj-siden
-- kan vise galleriet under riktig prosjekt og lønnsomhets-analyse kan
-- aggregere print-orders mot prosjekt-id.
ALTER TABLE photographer_client_galleries
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS photographer_client_galleries_project_idx
  ON photographer_client_galleries (project_id);

COMMENT ON COLUMN projects.client_id IS
  'Kobling til canonical clients.id. NULL for prosjekter uten CRM-klient (kun fritekst i client_name).';
COMMENT ON COLUMN projects.service_price IS
  'Avtalt pris med klient for hele prosjektet (NOK). Brukes til lønnsomhetsberegning.';
COMMENT ON COLUMN projects.hourly_rate IS
  'Timepris fotografen bruker for å estimere kostnad mot tracked hours.';
COMMENT ON COLUMN projects.cost_overhead IS
  'Faste eksterne kostnader (utstyrsleie, reise, etc) som trekkes fra inntekt.';
