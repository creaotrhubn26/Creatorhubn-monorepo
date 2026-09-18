/**
 * Dagens rigg skrevet inn i `equipment_bookings`.
 *
 * Tabellen har stått tom i produksjon siden migrasjon 097 opprettet den. Hele
 * maskineriet rundt den finnes allerede — POST /equipment/:id/bookings,
 * GET /equipment/:id/availability, POST /equipment/:id/conflicts/check — men
 * ingen skrev noe inn, så tilgjengelighet og konflikter svarte alltid «fritt».
 *
 * Når en opptaksdag lagres med utstyr er det nettopp en booking: denne
 * enheten, denne datoen, dette prosjektet. Synkroniseringen er nøklet på
 * `event_id = <produksjonsdag-id>` og er idempotent, slik at den kan kjøres
 * ved hver lagring uten å samle opp duplikater.
 */

interface QueryablePool {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
}

export interface EquipmentBookingSyncResult {
  /** Enheter som nå har en bekreftet booking for dagen. */
  booked: number;
  /** Bookinger som ble avbestilt fordi enheten er tatt av dagen. */
  cancelled: number;
}

/** En uuid, som `equipment_bookings.equipment_id` krever. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function syncProductionDayEquipmentBookings(
  pool: QueryablePool,
  input: {
    projectId: string;
    dayId: string;
    /** Dagen bookingen gjelder, YYYY-MM-DD. */
    date: string | null;
    equipmentIds: readonly string[];
    bookedBy: string;
  },
): Promise<EquipmentBookingSyncResult> {
  const { projectId, dayId, date, equipmentIds, bookedBy } = input;

  // Uten dato finnes det ikke noe tidsrom å booke. Da avbestilles alt som
  // måtte ligge igjen fra en tidligere lagring, framfor å la det bli hengende.
  const gyldige = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? [...new Set(equipmentIds.map(String).filter((id) => UUID.test(id)))]
    : [];

  let booked = 0;
  for (const equipmentId of gyldige) {
    // Én booking per enhet per dag. `ON CONFLICT` finnes ikke på denne
    // tabellen, så oppdater først og sett inn bare hvis ingenting traff.
    const oppdatert = await pool.query(
      `UPDATE equipment_bookings
          SET start_date = $3::date,
              end_date   = $3::date + INTERVAL '1 day',
              status     = 'confirmed',
              updated_at = now()
        WHERE project_id = $1 AND event_id = $2 AND equipment_id = $4::uuid`,
      [projectId, dayId, date, equipmentId],
    );
    if (!oppdatert.rowCount) {
      await pool.query(
        `INSERT INTO equipment_bookings
           (equipment_id, project_id, booked_by, event_id, start_date, end_date, status, notes)
         VALUES ($4::uuid, $1, $5, $2, $3::date, $3::date + INTERVAL '1 day', 'confirmed', $6)`,
        [projectId, dayId, date, equipmentId, bookedBy, `Opptaksdag ${date}`],
      );
    }
    booked += 1;
  }

  // Enheter som er tatt av dagen avbestilles, ikke slettes: hvem som booket
  // hva og når er produksjonshistorikk, ikke støy.
  const avbestilt = await pool.query(
    `UPDATE equipment_bookings
        SET status = 'cancelled', updated_at = now()
      WHERE project_id = $1
        AND event_id = $2
        AND status <> 'cancelled'
        AND NOT (equipment_id::text = ANY($3::text[]))`,
    [projectId, dayId, gyldige],
  );

  return { booked, cancelled: avbestilt.rowCount ?? 0 };
}
