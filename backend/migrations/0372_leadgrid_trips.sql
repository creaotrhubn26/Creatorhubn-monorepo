-- 0372: leadgrid_trips — Leadgrid Go elektronisk kjørebok (2026-07-13)
--
-- Auto-loggede kjøreturer (fra nav-motoren; senere background-deteksjon).
-- Per bruker (user_id). Føreren attesterer formål (Skatteetaten-krav) —
-- purpose default 'unconfirmed'. Beløp (kjøregodtgjørelse/bom) lagres som
-- beregnet av klienten, kan re-beregnes ved eksport.
--
-- IDOR: alle spørringer i leadgrid-trips-routes.ts filtrerer på user_id =
-- caller-session. Ingen org-deling — kjøreboka er personlig.

CREATE TABLE IF NOT EXISTS leadgrid_trips (
  id             UUID PRIMARY KEY,
  user_id        TEXT NOT NULL,
  start_date     TIMESTAMPTZ NOT NULL,
  end_date       TIMESTAMPTZ NOT NULL,
  start_place    TEXT NOT NULL DEFAULT '',
  end_place      TEXT NOT NULL DEFAULT '',
  start_lat      DOUBLE PRECISION,
  start_lon      DOUBLE PRECISION,
  end_lat        DOUBLE PRECISION,
  end_lon        DOUBLE PRECISION,
  distance_km    DOUBLE PRECISION NOT NULL DEFAULT 0,
  vehicle_name   TEXT,
  vehicle_plate  TEXT,
  purpose        TEXT NOT NULL DEFAULT 'unconfirmed',
  note           TEXT NOT NULL DEFAULT '',
  mileage_amount DOUBLE PRECISION,
  toll_amount    DOUBLE PRECISION,
  source         TEXT NOT NULL DEFAULT 'auto',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_trips_user_start
  ON leadgrid_trips (user_id, start_date DESC);
