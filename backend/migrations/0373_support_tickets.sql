-- Migration 0373: support_tickets
--
-- Dedikert support-/hjelp-løsning for produktet (workspace m.fl.). Egen tabell,
-- bevisst adskilt fra role_room_tickets (The Role Room er et separat produkt).
-- Brukere sender inn via workspace-support-dialogen; admin triagerer i
-- AdminDashboard → «Kundestøtte». Auto-kontekst (URL, fane, prosjekt, viewport,
-- UA) lagres i context-feltet så admin kan hjelpe uten å spørre.

CREATE TABLE IF NOT EXISTS support_tickets (
  id              SERIAL PRIMARY KEY,
  source          VARCHAR(32) NOT NULL DEFAULT 'workspace', -- workspace | web | other
  category        VARCHAR(24) NOT NULL,   -- bug | feature | question | other
  priority        VARCHAR(16) NOT NULL,   -- low | medium | high | critical
  status          VARCHAR(20) NOT NULL DEFAULT 'open', -- open | in_progress | resolved | closed
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  user_id         TEXT,
  user_email      TEXT,
  user_name       TEXT,
  context         JSONB NOT NULL DEFAULT '{}'::jsonb,   -- url, tab, prosjekt, viewport, UA
  assigned_to     TEXT,                                  -- admin-e-post (triage)
  resolution_note TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_tickets_status_idx   ON support_tickets (status);
CREATE INDEX IF NOT EXISTS support_tickets_category_idx ON support_tickets (category);
CREATE INDEX IF NOT EXISTS support_tickets_created_idx  ON support_tickets (created_at DESC);
