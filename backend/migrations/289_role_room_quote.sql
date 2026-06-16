-- 289_role_room_quote.sql
-- The Role Room pristilbud (egen feature — IKKE Creatorhubs generiske
-- quotes-tabell). Innholdsprodusenten bygger et tilbud med linjeposter og
-- sender det til klienten. Linjeposter + totaler lagres; soft-refs.

CREATE TABLE IF NOT EXISTS role_room_quote (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    TEXT NOT NULL,
  owner_user_id TEXT,
  quote_number  TEXT,
  client_name   TEXT,
  line_items    JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{label,detail,units,unitLabel,unitPriceKr}]
  discount_pct  NUMERIC NOT NULL DEFAULT 0,
  vat_pct       NUMERIC NOT NULL DEFAULT 25,
  valid_until   DATE,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'draft',       -- draft | sent | accepted | declined
  subtotal_kr   NUMERIC NOT NULL DEFAULT 0,
  total_kr      NUMERIC NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_room_quote_project
  ON role_room_quote (project_id, created_at DESC);
