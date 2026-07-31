-- Produksjonseid lagring.
--
-- Fram til nå var all kvote nøklet på user_id. En produksjon med 15 i
-- crewet fikk dermed 15 separate kvoter, og de 800 GB med dailies fra
-- innspillingsdagen ble belastet han som tilfeldigvis trykket opplast på
-- iPad-en. Byttet produksjonen DIT midtveis, fulgte ikke lagringen med.
-- Og fakturaen kunne bare gå til en enkeltperson, aldri til selskapet.
--
-- Modellen her skiller to ting som ble blandet:
--
--   Produksjonen  eier bytene. Hver fil bokføres på prosjektet, uansett
--                 hvem i crewet som lastet den opp.
--   Kontoen       betaler. Planens inkluderte kvote er en pott på konto-
--                 nivå som alle kontoens produksjoner trekker fra.
--
-- Det er derfor included_bytes IKKE ligger her: la den ligge per
-- produksjon ville hver nye produksjon gitt en ny gratis kvote, og en
-- konto kunne fått ubegrenset lagring ved å opprette prosjekter.
-- Potten hører til planen, forbruket hører til produksjonen.

CREATE TABLE IF NOT EXISTS role_room_production_storage (
  project_id VARCHAR(255) PRIMARY KEY
    REFERENCES casting_projects(id) ON DELETE CASCADE,

  -- Kontoen som faktureres for denne produksjonen. Settes til
  -- casting_projects.created_by ved opprettelse, men kan flyttes når
  -- produksjonsselskapet overtar fakturaen fra en enkeltperson — uten at
  -- filene røres.
  billing_user_id VARCHAR(255) NOT NULL,

  used_bytes BIGINT NOT NULL DEFAULT 0,
  -- Breakdown per lager. Kostnaden er ulik: B2/R2 prises per GB lagret,
  -- Cloudflare Stream per lagret og levert minutt. Uten dette skillet
  -- kan marginen ikke regnes.
  b2_bytes BIGINT NOT NULL DEFAULT 0,
  r2_bytes BIGINT NOT NULL DEFAULT 0,
  stream_bytes BIGINT NOT NULL DEFAULT 0,
  filesystem_bytes BIGINT NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,

  -- Valgfritt tak for én produksjon. NULL = ingen egen grense, bare
  -- kontoens pott. Finnes for å hindre at én produksjon med 40 TB
  -- dailies spiser hele kontoens kvote fra de andre.
  quota_override_bytes BIGINT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reconciled_at TIMESTAMPTZ,
  reconcile_notes TEXT
);

-- Kontoens totale forbruk er summen over produksjonene den betaler for.
-- Denne indeksen er den summen.
CREATE INDEX IF NOT EXISTS role_room_production_storage_billing_idx
  ON role_room_production_storage (billing_user_id);

-- Hver hendelse som flyttet tallet. Brukes til å forklare en faktura og
-- til å avstemme hvis B2 og databasen sprikker.
CREATE TABLE IF NOT EXISTS role_room_production_storage_events (
  id BIGSERIAL PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  -- Hvem i crewet som utløste den. Ikke den som betaler — den som
  -- lastet opp. Gjør at "hvorfor vokste dette" har et svar.
  actor_user_id VARCHAR(255),
  delta_bytes BIGINT NOT NULL,
  backend TEXT NOT NULL,
  reason TEXT NOT NULL,
  related_resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_production_storage_events_project_idx
  ON role_room_production_storage_events (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS role_room_production_storage_events_resource_idx
  ON role_room_production_storage_events (related_resource_id)
  WHERE related_resource_id IS NOT NULL;

-- Atomisk oppdatering av teller + revisjonsspor, samme mønster som
-- apply_storage_consumption_delta.
--
-- p_backend som ikke treffer noen breakdown-kolonne havner likevel i
-- used_bytes og i events. Da stemmer ikke summen av kolonnene med
-- totalen, men totalen — den fakturaen bygger på — forblir riktig.
CREATE OR REPLACE FUNCTION apply_production_storage_delta(
  p_project_id VARCHAR(255),
  p_billing_user_id VARCHAR(255),
  p_actor_user_id VARCHAR(255),
  p_delta_bytes BIGINT,
  p_backend TEXT,
  p_reason TEXT,
  p_related TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS BIGINT AS $$
DECLARE
  new_used BIGINT;
BEGIN
  INSERT INTO role_room_production_storage (
    project_id, billing_user_id, used_bytes,
    b2_bytes, r2_bytes, stream_bytes, filesystem_bytes, file_count
  )
  VALUES (
    p_project_id,
    p_billing_user_id,
    GREATEST(0, p_delta_bytes),
    CASE WHEN p_backend = 'b2' THEN GREATEST(0, p_delta_bytes) ELSE 0 END,
    CASE WHEN p_backend = 'r2' THEN GREATEST(0, p_delta_bytes) ELSE 0 END,
    CASE WHEN p_backend = 'cloudflare_stream' THEN GREATEST(0, p_delta_bytes) ELSE 0 END,
    CASE WHEN p_backend = 'filesystem' THEN GREATEST(0, p_delta_bytes) ELSE 0 END,
    CASE WHEN p_delta_bytes > 0 THEN 1 ELSE 0 END
  )
  ON CONFLICT (project_id) DO UPDATE SET
    -- billing_user_id oppdateres IKKE her. Hvem som betaler er en
    -- beslutning noen tar bevisst, ikke noe en filopplasting skal endre.
    used_bytes = GREATEST(0, role_room_production_storage.used_bytes + p_delta_bytes),
    b2_bytes = CASE WHEN p_backend = 'b2'
                 THEN GREATEST(0, role_room_production_storage.b2_bytes + p_delta_bytes)
                 ELSE role_room_production_storage.b2_bytes END,
    r2_bytes = CASE WHEN p_backend = 'r2'
                 THEN GREATEST(0, role_room_production_storage.r2_bytes + p_delta_bytes)
                 ELSE role_room_production_storage.r2_bytes END,
    stream_bytes = CASE WHEN p_backend = 'cloudflare_stream'
                 THEN GREATEST(0, role_room_production_storage.stream_bytes + p_delta_bytes)
                 ELSE role_room_production_storage.stream_bytes END,
    filesystem_bytes = CASE WHEN p_backend = 'filesystem'
                 THEN GREATEST(0, role_room_production_storage.filesystem_bytes + p_delta_bytes)
                 ELSE role_room_production_storage.filesystem_bytes END,
    file_count = GREATEST(0, role_room_production_storage.file_count
                   + CASE WHEN p_delta_bytes > 0 THEN 1
                          WHEN p_delta_bytes < 0 THEN -1
                          ELSE 0 END),
    updated_at = now()
  RETURNING used_bytes INTO new_used;

  INSERT INTO role_room_production_storage_events (
    project_id, actor_user_id, delta_bytes, backend, reason,
    related_resource_id, metadata
  )
  VALUES (
    p_project_id, p_actor_user_id, p_delta_bytes, p_backend, p_reason,
    p_related, p_metadata
  );

  RETURN new_used;
END;
$$ LANGUAGE plpgsql;
