-- Asset-versjonering for kameramedier.
--
-- Fram til nå var nøkkelen deterministisk:
--
--   {prefiks}{eier}/{sesjon}/{asset}/{kind}/{filnavn}
--
-- Lastet noen opp samme asset og kind på nytt — en re-eksport, en
-- omkonvertering, en fil som feilet halvveis og ble sendt igjen — traff
-- den NØYAKTIG samme nøkkel og overskrev objektet i bøtta. Den gamle
-- fila var borte, uten spor, og `capture_assets.full_key` pekte på nye
-- bytes under samme navn.
--
-- Det er alvorlig i en filmproduksjon av tre grunner:
--
--   1. En godkjenning gjelder en bestemt fil. Overskrives den, vet ingen
--      lenger hva som faktisk ble godkjent.
--   2. En kommentar med timecode hører til ett bestemt klipp. Byttes
--      bytene under den, peker kommentaren feil sted.
--   3. Checksummen i asset-raden slutter å beskrive objektet.
--
-- Modellen her legger historikken ved siden av, uten å røre lesestiene:
-- `capture_assets.preview_key/full_key/raw_key` fortsetter å peke på
-- GJELDENDE versjon, så de rundt 40 stedene som signerer en URL fra en
-- bar nøkkel er urørt. Denne tabellen er hva som ellers har vært der.
--
-- Nye nøkler får et versjonsledd (…/{kind}/v3/{filnavn}). Gamle nøkler
-- har det ikke, og fungerer videre — de leses fra nøkkelen som står i
-- databasen, ikke fra en gjenoppbygget sti.

CREATE TABLE IF NOT EXISTS capture_asset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES capture_assets(id) ON DELETE CASCADE,

  -- 'preview' | 'full' | 'raw'. Hver kind versjoneres for seg: en ny
  -- preview gjør ikke originalen til versjon 2.
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('preview', 'full', 'raw')),
  version_number INTEGER NOT NULL CHECK (version_number > 0),

  object_key TEXT NOT NULL,
  bucket TEXT NOT NULL,
  -- Hvilket lager objektet ligger i. Samme grunn som ellers: en versjon
  -- skrevet før B2 ble primær ligger fortsatt i R2.
  backend TEXT NOT NULL CHECK (backend IN ('b2', 'r2')),

  size_bytes BIGINT,
  checksum_sha256 VARCHAR(64),
  content_type VARCHAR(128),

  -- 'uploading' → 'ready' → 'released'.
  -- Raden opprettes ved START av opplastingen, ikke ved slutten: vi
  -- trenger versjonsnummeret for å bygge nøkkelen, og nummeret må være
  -- reservert før to samtidige opplastinger kan få samme.
  status VARCHAR(16) NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'ready', 'released')),

  uploaded_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at TIMESTAMPTZ,
  -- Satt når en nyere versjon overtok. Den gamle fila blir liggende og
  -- koster fortsatt penger — den er avløst, ikke slettet.
  superseded_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,

  -- Reservasjonen som gjør samtidige opplastinger trygge: to som prøver
  -- å ta samme nummer kolliderer her framfor å skrive samme nøkkel.
  UNIQUE (asset_id, kind, version_number)
);

-- Nyeste versjon per asset og kind — oppslaget både historikkvisningen
-- og nummer-tildelingen gjør.
CREATE INDEX IF NOT EXISTS capture_asset_versions_asset_idx
  ON capture_asset_versions (asset_id, kind, version_number DESC);

-- Finne igjen en versjon fra en bar objektnøkkel, f.eks. når frigjøring
-- eller avstemming starter fra det som ligger i bøtta.
CREATE INDEX IF NOT EXISTS capture_asset_versions_key_idx
  ON capture_asset_versions (object_key);

-- Ufullførte opplastinger som skal ryddes.
CREATE INDEX IF NOT EXISTS capture_asset_versions_uploading_idx
  ON capture_asset_versions (created_at)
  WHERE status = 'uploading';
