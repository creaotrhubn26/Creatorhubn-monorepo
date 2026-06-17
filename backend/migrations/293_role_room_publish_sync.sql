-- 293_role_room_publish_sync.sql
-- Draft → publiser → synk-grense mellom innholdsprodusent og klient.
--
-- Bakgrunn: de delte producer↔klient-flatene synket «umiddelbart» uten noen
-- privatsfære. Ønsket modell: hver part kan holde noe som DRAFT (privat),
-- og det synker til motparten KUN når det publiseres — med frist (due_at,
-- finnes allerede) og påminnelse (egen cron, neste migrasjon/route).
--
-- Felles mønster: `published_at` (NULL = draft/privat, satt = synlig for
-- motparten) + `published_by_user_id` (revisjon/hvem publiserte).
-- Klient-lesefilteret i backend gater på `published_at IS NOT NULL`.
--
-- Backfill er prinsipiell og regresjonsfri: alt som ER klient-synlig i dag
-- markeres som publisert (beholder synlighet), alt som er privat i dag forblir
-- draft. Ingen eksisterende rad endrer synlighet.

-- ── 1. Tidslinje / plan ───────────────────────────────────────────────────
ALTER TABLE role_room_phase_timeline_items
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by_user_id VARCHAR(255);
-- Tidslinje var klient-synlig (read-only) i sin helhet → backfill alle.
UPDATE role_room_phase_timeline_items
  SET published_at = COALESCE(updated_at, created_at, NOW())
  WHERE published_at IS NULL;

-- ── 2. Økonomi / budsjett ─────────────────────────────────────────────────
ALTER TABLE role_room_budget_items
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by_user_id VARCHAR(255);
-- Kun det som var client_visible blir publisert; resten forblir draft.
UPDATE role_room_budget_items
  SET published_at = COALESCE(updated_at, created_at, NOW())
  WHERE published_at IS NULL AND client_visible = TRUE;

-- ── 3. Godkjenning / client reviews ───────────────────────────────────────
ALTER TABLE role_room_client_reviews
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by_user_id VARCHAR(255);
-- En review «sendes» (= publiseres) når den opprettes → backfill = requested_at.
UPDATE role_room_client_reviews
  SET published_at = COALESCE(requested_at, created_at, NOW())
  WHERE published_at IS NULL;

-- ── 4. Brief / client intake ──────────────────────────────────────────────
ALTER TABLE role_room_client_intake
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by_user_id VARCHAR(255);
-- Brief var delt/synlig for begge i dag → backfill alle.
UPDATE role_room_client_intake
  SET published_at = COALESCE(updated_at, NOW())
  WHERE published_at IS NULL;

-- ── 5. Leveranser ─────────────────────────────────────────────────────────
ALTER TABLE role_room_deliverables
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by_user_id VARCHAR(255);
-- Kun klient-vendte statuser (client_review/delivered) er publisert.
UPDATE role_room_deliverables
  SET published_at = COALESCE(delivered_at, updated_at, created_at, NOW())
  WHERE published_at IS NULL AND status IN ('client_review', 'delivered');

-- ── Påminnelse-skann-indekser: upubliserte rader med frist ────────────────
-- Cron-jobben leter etter draft (published_at IS NULL) som har due_at, for å
-- minne eieren om å publisere før fristen.
CREATE INDEX IF NOT EXISTS idx_rr_timeline_unpublished_due
  ON role_room_phase_timeline_items (project_id, due_at)
  WHERE published_at IS NULL AND due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rr_reviews_unpublished_due
  ON role_room_client_reviews (project_id, due_at)
  WHERE published_at IS NULL AND due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rr_deliverables_unpublished_due
  ON role_room_deliverables (project_id, due_at)
  WHERE published_at IS NULL AND due_at IS NOT NULL;

COMMENT ON COLUMN role_room_phase_timeline_items.published_at IS
  'NULL = draft (privat for produsent), satt = publisert/synlig for klient. Klient-lesefilter gater på dette.';
COMMENT ON COLUMN role_room_budget_items.published_at IS
  'NULL = draft (privat for produsent), satt = publisert/synlig for klient.';
COMMENT ON COLUMN role_room_client_reviews.published_at IS
  'NULL = draft (ikke sendt), satt = sendt/synlig for klient.';
COMMENT ON COLUMN role_room_client_intake.published_at IS
  'NULL = draft, satt = publisert snapshot synlig for motparten.';
COMMENT ON COLUMN role_room_deliverables.published_at IS
  'NULL = draft/intern, satt = publisert til klient (status client_review/delivered).';
