-- 291_role_room_deliverables.sql
-- Strukturert leveranse-modell for The Role Room Planner (data-gap #2 fra
-- Planner-design-passet). Tidligere fantes leveranser kun implisitt som
-- review-items + en role.deliverables-streng + content-kalender-items — uten
-- en egen modell med format, frist, versjon og status-flyt. Denne tabellen
-- gir Leveranser-boardet (Utkast → Intern review → Klient-review → Levert) og
-- «Kommende leveranser» en ekte kilde.

CREATE TABLE IF NOT EXISTS role_room_deliverables (
  id               UUID PRIMARY KEY,
  project_id       TEXT NOT NULL,
  title            TEXT NOT NULL,
  format           TEXT,                                  -- f.eks. "Hovedfilm 30s", "Cutdown 15s", "Stills-pakke"
  phase            TEXT,                                  -- preproduction | production | postproduction
  status           TEXT NOT NULL DEFAULT 'draft',         -- draft | internal_review | client_review | delivered
  due_at           TIMESTAMPTZ,                           -- frist
  version          INTEGER NOT NULL DEFAULT 1,
  assignee_user_id TEXT,
  assignee_label   TEXT,
  waiting_on       TEXT,                                  -- hvem vi venter på (fri tekst / rolle)
  notes            TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  delivered_at     TIMESTAMPTZ,                           -- settes når status → delivered
  created_by_user_id TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Board-/oversikt-spørringer scoper alltid på prosjekt + status.
CREATE INDEX IF NOT EXISTS role_room_deliverables_project_idx
  ON role_room_deliverables (project_id, status);

-- «Kommende leveranser» / forfall sorterer på frist.
CREATE INDEX IF NOT EXISTS role_room_deliverables_due_idx
  ON role_room_deliverables (project_id, due_at)
  WHERE status <> 'delivered';

COMMENT ON TABLE role_room_deliverables IS
  'Strukturerte leveranser per Role Room-prosjekt med status-flyt draft→internal_review→client_review→delivered, format, frist og versjon.';
