-- 0454_role_room_equipment_qr.sql
--
-- Del A punkt 98: QR inn/ut-skanning. «Gjør 97 troverdig.»
--
-- Dobbeltbooking-sperren (0447) hindrer at samme utstyr LOVES bort to ganger.
-- Den sier ingenting om hvor tingene faktisk er. equipment_checkouts fantes
-- fra før, og QR-skanneren finnes i frontend — men det manglet en identitet å
-- skanne. Uten den må noen skrive av et serienummer for hånd, og da blir
-- utleveringen ikke registrert.
--
-- Koden er kort og ugjettbar. Kort fordi den skal kunne leses opp høyt når
-- klistremerket er slitt; ugjettbar fordi den gir rett til å kvittere ut
-- utstyr i prosjektets navn.

ALTER TABLE casting_equipment
  ADD COLUMN IF NOT EXISTS qr_code VARCHAR(24);

-- Tildel kode til alt eksisterende utstyr. base32-lignende alfabet uten
-- tegnene som forveksles ved avlesning: I/1, O/0, U (kan leses som V).
DO $$
DECLARE
  r RECORD;
  candidate TEXT;
  alphabet TEXT := '23456789ABCDEFGHJKLMNPQRSTVWXYZ';
BEGIN
  FOR r IN SELECT id FROM casting_equipment WHERE qr_code IS NULL LOOP
    LOOP
      candidate := 'RR-' || (
        SELECT string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
          FROM generate_series(1, 8)
      );
      EXIT WHEN NOT EXISTS (SELECT 1 FROM casting_equipment WHERE qr_code = candidate);
    END LOOP;
    UPDATE casting_equipment SET qr_code = candidate WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_casting_equipment_qr_code
  ON casting_equipment (qr_code)
  WHERE qr_code IS NOT NULL;

COMMENT ON COLUMN casting_equipment.qr_code IS
  'Kode på klistremerket. Alfabet uten I/O/U/0/1 fordi den skal kunne leses opp høyt når merket er slitt.';

-- ── Utvid checkouts ──────────────────────────────────────────────────────
-- Tabellen fantes, men uten spor av HVORDAN registreringen skjedde. Skillet
-- mellom skannet og manuelt ført er verdt å ha når noe er borte.

ALTER TABLE equipment_checkouts
  ADD COLUMN IF NOT EXISTS checked_out_via VARCHAR(20) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS checked_in_via  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS checked_in_by   VARCHAR(255);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_checkouts_via_vocab') THEN
    ALTER TABLE equipment_checkouts
      ADD CONSTRAINT equipment_checkouts_via_vocab
      CHECK (
        checked_out_via IN ('manual','qr')
        AND (checked_in_via IS NULL OR checked_in_via IN ('manual','qr'))
      );
  END IF;
END $$;

-- «Hva er fortsatt ute» — spørringen som stilles på slutten av dagen.
CREATE INDEX IF NOT EXISTS idx_equipment_checkouts_outstanding
  ON equipment_checkouts (equipment_id)
  WHERE checked_in_at IS NULL;

COMMENT ON COLUMN equipment_checkouts.checked_out_via IS
  'qr = skannet, manual = ført for hånd. Skillet er verdt å ha når noe er borte.';
