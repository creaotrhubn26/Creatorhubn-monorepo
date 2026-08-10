-- 0447_role_room_equipment_booking_capacity.sql
--
-- Del A punkt 97: dobbeltbooking-sperre for utstyr. «Eneste stans-forhindrer
-- i A8» — utstyr som viser seg å være booket to steder oppdages typisk på
-- opptaksdagen, når det er for sent å skaffe noe annet.
--
-- equipment_bookings hadde datoer og indeks, men ingen sperre: to bookinger
-- av samme kamera i overlappende periode gikk rett inn.
--
-- Hvorfor trigger og ikke EXCLUDE-constraint: utstyr har `quantity` (fem
-- kameraer av samme modell). En EXCLUDE på (equipment_id, periode) ville
-- blokkert booking nummer to selv når det står fire igjen på lager. Det som
-- skal sperres er overbooking av BEHOLDNINGEN, ikke overlapp i seg selv.
--
-- Intervallene er halvåpne [start, slutt): en booking som slutter presis når
-- den neste starter regnes ikke som overlapp. Rygg-mot-rygg-utleie samme dag
-- er normalt i bransjen og skal fortsatt gå.

CREATE OR REPLACE FUNCTION rr_check_equipment_booking_capacity() RETURNS trigger AS $$
DECLARE
  stock         INTEGER;
  already_booked INTEGER;
  equipment_name TEXT;
BEGIN
  -- Kansellerte bookinger legger ikke beslag på noe.
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Serialiser sjekk+skriving per utstyrsenhet. Uten dette kan to samtidige
  -- transaksjoner begge lese «det er plass» og begge skrive — klassisk
  -- sjekk-så-skriv-kappløp. Låsen slippes når transaksjonen avsluttes.
  PERFORM pg_advisory_xact_lock(hashtext(NEW.equipment_id::text));

  SELECT quantity, name INTO stock, equipment_name
    FROM casting_equipment WHERE id = NEW.equipment_id;

  -- Ukjent utstyr håndteres av fremmednøkkelen, ikke her.
  IF stock IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO already_booked
    FROM equipment_bookings
   WHERE equipment_id = NEW.equipment_id
     AND status <> 'cancelled'
     AND id IS DISTINCT FROM NEW.id
     AND tstzrange(start_date, end_date, '[)')
         && tstzrange(NEW.start_date, NEW.end_date, '[)');

  IF already_booked + NEW.quantity > stock THEN
    RAISE EXCEPTION
      'Dobbeltbooking av «%»: % av % enheter er allerede booket i perioden, forsøkte å booke % til.',
      COALESCE(equipment_name, NEW.equipment_id::text), already_booked, stock, NEW.quantity
      USING ERRCODE = 'check_violation',
            HINT = 'Velg en annen periode, reduser antallet, eller kanseller den overlappende bookingen.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rr_equipment_booking_capacity ON equipment_bookings;
CREATE TRIGGER trg_rr_equipment_booking_capacity
  BEFORE INSERT OR UPDATE OF equipment_id, start_date, end_date, quantity, status
  ON equipment_bookings
  FOR EACH ROW EXECUTE FUNCTION rr_check_equipment_booking_capacity();

-- Overlappssøket går på (equipment_id, periode) — indeksen under gjør at
-- sjekken ikke blir en full scan når bookinglisten vokser.
CREATE INDEX IF NOT EXISTS idx_equipment_bookings_capacity_lookup
  ON equipment_bookings (equipment_id, start_date, end_date)
  WHERE status <> 'cancelled';

COMMENT ON FUNCTION rr_check_equipment_booking_capacity() IS
  'Del A punkt 97: hindrer at overlappende bookinger overstiger casting_equipment.quantity.';
