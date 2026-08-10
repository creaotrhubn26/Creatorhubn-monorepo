/**
 * role-room-equipment-availability.ts
 *
 * «Er dette utstyret ledig i perioden?» (Del A punkt 97).
 *
 * Selve sperren mot dobbeltbooking ligger i databasen (trigger fra migrering
 * 0447) — den er siste skanse og kan ikke omgås. Denne modulen er det motsatte
 * hjørnet: den lar UI og agenter få vite om noe er ledig FØR de forsøker, slik
 * at brukeren møter «3 av 5 ledig 12.–14. august» framfor en avvist lagring.
 */

import type { Pool } from "pg";

export interface AvailabilityRequest {
  equipmentId: string;
  startDate: string;
  endDate: string;
  /** Antall enheter det spørres om. Default 1. */
  quantity?: number;
  /** Utelat en eksisterende booking — brukes når en booking flyttes. */
  excludeBookingId?: string;
}

export interface AvailabilityResult {
  equipmentId: string;
  equipmentName: string | null;
  stock: number;
  bookedInPeriod: number;
  available: number;
  requested: number;
  isAvailable: boolean;
  /** Bookingene som legger beslag på utstyret i perioden. */
  conflicts: Array<{
    id: string;
    project_id: string;
    start_date: string;
    end_date: string;
    quantity: number;
    status: string;
  }>;
}

/**
 * Halvåpne intervaller [start, slutt) — samme regel som triggeren. En booking
 * som slutter presis når den neste starter er ikke en konflikt, fordi
 * rygg-mot-rygg-utleie samme dag er normalt.
 */
export async function checkEquipmentAvailability(
  pool: Pool,
  req: AvailabilityRequest,
): Promise<AvailabilityResult> {
  const quantity = Number.isFinite(Number(req.quantity)) && Number(req.quantity) > 0
    ? Math.floor(Number(req.quantity))
    : 1;

  const equipment = await pool.query<{ name: string; quantity: number }>(
    `SELECT name, quantity FROM casting_equipment WHERE id = $1 LIMIT 1`,
    [req.equipmentId],
  );
  if (equipment.rowCount === 0) {
    throw new Error(`Ukjent utstyr: ${req.equipmentId}`);
  }
  const stock = Number(equipment.rows[0].quantity ?? 0);

  const conflicts = await pool.query(
    `SELECT id, project_id, start_date, end_date, quantity, status
       FROM equipment_bookings
      WHERE equipment_id = $1
        AND status <> 'cancelled'
        AND ($4::uuid IS NULL OR id <> $4::uuid)
        AND tstzrange(start_date, end_date, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
      ORDER BY start_date`,
    [req.equipmentId, req.startDate, req.endDate, req.excludeBookingId ?? null],
  );

  const bookedInPeriod = conflicts.rows.reduce(
    (sum, r) => sum + Number((r as { quantity: number }).quantity ?? 0),
    0,
  );
  const available = Math.max(stock - bookedInPeriod, 0);

  return {
    equipmentId: req.equipmentId,
    equipmentName: equipment.rows[0].name ?? null,
    stock,
    bookedInPeriod,
    available,
    requested: quantity,
    isAvailable: available >= quantity,
    conflicts: conflicts.rows as AvailabilityResult["conflicts"],
  };
}

/**
 * Postgres-feilkoden triggeren reiser. Rutene bør fange denne og svare 409
 * med meldingen framfor å la den boble opp som 500 — det er en forventet
 * tilstand, ikke en systemfeil.
 */
export const EQUIPMENT_OVERBOOK_ERRCODE = "23514";

export function isOverbookingError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === EQUIPMENT_OVERBOOK_ERRCODE && /Dobbeltbooking/i.test(e?.message ?? "");
}
