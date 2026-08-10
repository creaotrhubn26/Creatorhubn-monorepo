-- Egress-måling.
--
-- Lagring og egress er to ulike kostnader. Lagring løper så lenge fila
-- finnes; egress løper hver gang noen henter den. En produksjon som
-- laster ned dailies daglig kan koste mer i egress enn i lagring — og
-- fram til nå målte vi ingenting av det.
--
-- B2 gir gratis egress opp til 3x lagret mengde per måned. Over det
-- påløper det. Uten disse tallene er det umulig å se når en kunde
-- passerer grensen, og marginen på den kunden er ukjent.
--
-- VIKTIG OM PRESISJON: nedlastingene går rett fra objektlageret til
-- klienten via en signert URL. Vi ser aldri bytene. Det vi kan måle er
-- at vi UTSTEDTE en URL for et objekt av kjent størrelse — altså en
-- nedlasting som sannsynligvis skjedde. Tallet er derfor et estimat, og
-- kolonnen heter det. Det overestimerer når en signert URL aldri brukes,
-- og underestimerer når den brukes flere ganger innen TTL-en.
-- Leverandørens egen fakturarapport er fasit; dette er det vi kan se
-- selv, per kunde og per produksjon, som fakturaen aldri viser.

CREATE TABLE IF NOT EXISTS storage_egress_events (
  id BIGSERIAL PRIMARY KEY,
  -- Kontoen egressen belastes. Alltid satt.
  user_id VARCHAR(255) NOT NULL,
  -- Produksjonen den tilhører, når vi vet det. Selftapes og personlige
  -- filer har ingen produksjon.
  project_id VARCHAR(255),
  backend TEXT NOT NULL,
  estimated_bytes BIGINT NOT NULL,
  -- Hvor i appen nedlastingen ble utløst: 'capture_asset',
  -- 'chunked_download', 'client_gallery', 'drive_sync', …
  source TEXT NOT NULL,
  related_resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Oppslaget som betyr noe: hva har denne kontoen hentet i inneværende
-- måned. Datoen først ville gjort per-konto-summeringen til en scan.
CREATE INDEX IF NOT EXISTS storage_egress_user_month_idx
  ON storage_egress_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS storage_egress_project_idx
  ON storage_egress_events (project_id, created_at DESC)
  WHERE project_id IS NOT NULL;
