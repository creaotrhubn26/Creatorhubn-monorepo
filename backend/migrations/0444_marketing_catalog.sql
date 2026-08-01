-- 0444_marketing_catalog.sql
--
-- Business DNA — Catalog (Pomelli-paritet, med Daniels vri): en produktkatalog
-- kampanjene kan trekke fra. Auto-populeres fra systemets vertikaler
-- (ALL_PROFESSION_MODES + topp-produkter), og admin kan legge til/fjerne når som
-- helst.
--
-- NB: servicen self-healer tabellen lazily (ensureTables) — denne fila er den
-- kanoniske skjemadefinisjonen.

CREATE TABLE IF NOT EXISTS marketing_catalog_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  item_key     TEXT,                                    -- vertikal-nøkkel (system) el. NULL (custom)
  name         VARCHAR(160) NOT NULL,
  description  TEXT,
  image_url    TEXT,
  source       VARCHAR(24) NOT NULL DEFAULT 'custom',   -- system_vertical | custom | url_import
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_key)                            -- én system-rad per vertikal (NULL-er er distinkte → custom OK)
);

CREATE INDEX IF NOT EXISTS idx_marketing_catalog_items_user
  ON marketing_catalog_items (user_id);
