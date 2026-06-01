-- 215_dance_formation_version_counter.sql
-- Workflow-audit A2: optimistic concurrency control.
--
-- Når to klienter redigerer samme formasjon samtidig kan sist-skriver-vinner-
-- semantikken føre til at den første brukerens endringer forsvinner stille.
-- Vi legger til en version-counter som bumpes ved hver UPDATE, og lar klienten
-- sende expected_version i PUT/PATCH. Mismatch → 409 + klient må reconcile.
--
-- Default = 1 for eksisterende rader. Klienter som ikke sender expected_version
-- får uendret oppførsel (siste-skriver-vinner, men version bumpes likevel slik
-- at fremtidige conflict-detect virker).

ALTER TABLE dance_formation
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- For hot-path conflict-detect (sjekke version før UPDATE).
-- Allerede dekket av primary key i de fleste tilfeller, men en kombinert
-- (id, version)-indeks gir oss raskere CAS-pattern.
CREATE INDEX IF NOT EXISTS dance_formation_id_version_idx
  ON dance_formation (id, version);
