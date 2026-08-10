-- 0448_role_room_call_sheet_receipts.sql
--
-- Del A punkt 68: distribusjon av call-sheet MED lest-kvittering.
--
-- Utsendingen fantes fra før (role-room-call-sheet-routes.ts) og logget
-- sendt/feilet per mottaker — men ikke om noen faktisk hadde sett den.
-- På opptaksdagen er det nettopp det AD-en trenger å vite: hvem har bekreftet
-- innkallingstiden, og hvem må ringes.
--
-- **Bekreftelse framfor sporingspiksel.** En piksel er upålitelig (de fleste
-- e-postklienter blokkerer bilder som standard) og ville vært skjult sporing
-- i et produkt som allerede har DPIA-plikt. En eksplisitt «Bekreft mottatt»-
-- lenke er både mer pålitelig og mer nyttig: den skiller «e-posten ble åpnet»
-- fra «personen har sett innkallingstiden sin».

CREATE TABLE IF NOT EXISTS role_room_call_sheet_distributions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  -- Fritekst-referanse til produksjonsdagen call-sheeten gjaldt.
  production_day_ref VARCHAR(255),
  subject           VARCHAR(255) NOT NULL,
  sent_by_user_id   VARCHAR(255),
  recipient_count   INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rr_call_sheet_dist_project
  ON role_room_call_sheet_distributions (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS role_room_call_sheet_receipts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES role_room_call_sheet_distributions(id) ON DELETE CASCADE,
  project_id      VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,

  recipient_email VARCHAR(255) NOT NULL,
  recipient_name  VARCHAR(255),

  -- Ugjettbart token i bekreftelseslenken. Unikt slik at én lenke aldri kan
  -- bekrefte på vegne av en annen mottaker.
  ack_token       VARCHAR(64) NOT NULL UNIQUE,

  -- Utsendingsresultat fra e-posttjenesten.
  sent            BOOLEAN NOT NULL DEFAULT FALSE,
  send_reason     VARCHAR(120),

  -- Satt når mottakeren har trykket «Bekreft mottatt».
  acknowledged_at TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Én kvittering per mottaker per utsending.
  CONSTRAINT rr_call_sheet_receipt_unique UNIQUE (distribution_id, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_rr_call_sheet_receipts_distribution
  ON role_room_call_sheet_receipts (distribution_id);

-- «Hvem mangler fortsatt bekreftelse» — spørringen AD-en stiller.
CREATE INDEX IF NOT EXISTS idx_rr_call_sheet_receipts_pending
  ON role_room_call_sheet_receipts (project_id, distribution_id)
  WHERE acknowledged_at IS NULL AND sent = TRUE;

COMMENT ON TABLE role_room_call_sheet_receipts IS
  'Lest-kvittering per call-sheet-mottaker (Del A punkt 68). Bekreftelse via lenke, ikke sporingspiksel.';
COMMENT ON COLUMN role_room_call_sheet_receipts.acknowledged_at IS
  'Satt når mottakeren aktivt har bekreftet. NULL = ikke bekreftet — kandidat for oppringing.';
