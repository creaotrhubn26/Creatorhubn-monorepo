-- 214_dance_formation_lock_and_timeline_items.sql
-- DanceFlow workflow-audit fix-pakke:
--   G14: lock-feltet på formasjoner — koreografen kan beskytte en formasjon
--        mot uhellsendring (pucks ikke draggable, slett-handler refuserer).
--   G18: time-anchored notes + movements på koreografi-timeline. Tidligere
--        var noter knyttet til formasjoner; nå kan koreografer knytte dem
--        til et tids-intervall (start_sec→end_sec) uavhengig av formasjons-
--        struktur (e.g. "Watch D2 & D4 cross @ 0:24-0:28").
--
-- Backwards-compat: locked defaulter til false. Eksisterende klienter som
-- ikke sender feltet får uendret oppførsel. timeline_items er en helt ny
-- tabell — eksisterende reads bryter ikke.

-- 1) G14: lock-felt
ALTER TABLE dance_formation
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;

-- 2) G18: timeline-items-tabell
-- Type-diskriminert: 'note' = tekst-note, 'movement' = bevegelse-beskrivelse.
-- Begge bruker samme tids-intervall-struktur (start_sec, end_sec).
-- Eier-scope identisk med dance_formation (owner_user_id + project_id).
CREATE TABLE IF NOT EXISTS dance_formation_timeline_item (
  id              TEXT PRIMARY KEY,
  owner_user_id   TEXT NOT NULL,
  project_id      TEXT,

  -- Diskriminator: 'note' eller 'movement'. CHECK-constraint sikrer at vi
  -- ikke kan lagre andre verdier.
  kind            TEXT NOT NULL CHECK (kind IN ('note', 'movement')),

  -- Innhold: short label for movement ('Walk', 'Reach'), full tekst for note.
  label           TEXT NOT NULL,

  -- Tids-intervall — påkrevd for begge typer. Validert at end >= start.
  start_sec       NUMERIC(10,2) NOT NULL,
  end_sec         NUMERIC(10,2) NOT NULL,

  -- Valgfri kobling til en spesifikk formasjon. NULL = standalone.
  formation_id    TEXT,

  -- Valgfri liste av dancer-IDs som er relevante for dette item.
  target_dancer_ids JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Display-order for items med samme tid (sjeldent men mulig).
  display_order   INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dance_formation_timeline_item_time_order
    CHECK (end_sec >= start_sec)
);

-- Hot path: list items per (owner, project) sortert etter start_sec.
CREATE INDEX IF NOT EXISTS dance_formation_timeline_item_owner_project_time_idx
  ON dance_formation_timeline_item (owner_user_id, project_id, start_sec, display_order);

-- Sekundær: filtrér per kind så frontend kan hente bare notes eller bare
-- movements uten å scanne hele tabellen.
CREATE INDEX IF NOT EXISTS dance_formation_timeline_item_kind_idx
  ON dance_formation_timeline_item (owner_user_id, project_id, kind, start_sec);
