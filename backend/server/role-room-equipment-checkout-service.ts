/**
 * role-room-equipment-checkout-service.ts
 *
 * Inn- og utsjekk av utstyr via QR (Del A punkt 98) — «gjør 97 troverdig».
 *
 * Dobbeltbooking-sperren (punkt 97) hindrer at samme utstyr LOVES bort to
 * ganger. Denne modulen svarer på det andre spørsmålet: hvor er tingene nå.
 * De to henger sammen — en booking som ingen henter, og en enhet som aldri
 * kommer tilbake, er to ulike problemer med samme symptom på opptaksdagen.
 *
 * Utsjekk er begrenset av fysisk beholdning, ikke av bookinger. En enhet som
 * står på lageret kan hentes selv om ingen booket den; en enhet som er ute
 * kan ikke hentes av to.
 */

import type { Pool, PoolClient } from "pg";

export class CheckoutError extends Error {
  constructor(
    message: string,
    public code: "unknown_code" | "none_available" | "not_checked_out" | "invalid_quantity",
  ) {
    super(message);
  }
}

export interface EquipmentStatus {
  equipmentId: string;
  qrCode: string | null;
  name: string;
  stock: number;
  checkedOut: number;
  onShelf: number;
  outstanding: Array<{
    id: string;
    checked_out_to: string;
    checked_out_at: string;
    quantity: number;
    project_id: string;
  }>;
}

/**
 * Slår opp utstyr på QR-koden og oppsummerer hvor enhetene er.
 * Koden normaliseres — den blir ofte tastet inn for hånd når klistremerket
 * er slitt, og da varierer store/små bokstaver og mellomrom.
 */
export async function getEquipmentByCode(pool: Pool, rawCode: string): Promise<EquipmentStatus> {
  const code = normalizeQrCode(rawCode);
  if (!code) throw new CheckoutError("Tom QR-kode.", "unknown_code");

  const eq = await pool.query<{ id: string; name: string; quantity: number; qr_code: string }>(
    `SELECT id, name, quantity, qr_code FROM casting_equipment WHERE upper(qr_code) = $1 LIMIT 1`,
    [code],
  );
  if (eq.rowCount === 0) {
    throw new CheckoutError(`Ukjent QR-kode: ${rawCode}`, "unknown_code");
  }
  const equipment = eq.rows[0];

  const outstanding = await pool.query(
    `SELECT id, checked_out_to, checked_out_at, quantity, project_id
       FROM equipment_checkouts
      WHERE equipment_id = $1 AND checked_in_at IS NULL
      ORDER BY checked_out_at`,
    [equipment.id],
  );

  const checkedOut = outstanding.rows.reduce(
    (sum, r) => sum + Number((r as { quantity: number }).quantity ?? 0),
    0,
  );
  const stock = Number(equipment.quantity ?? 0);

  return {
    equipmentId: equipment.id,
    qrCode: equipment.qr_code,
    name: equipment.name,
    stock,
    checkedOut,
    // Kan ikke bli negativ selv om historiske rader overstiger beholdningen.
    onShelf: Math.max(stock - checkedOut, 0),
    outstanding: outstanding.rows as EquipmentStatus["outstanding"],
  };
}

export function normalizeQrCode(raw: string): string {
  return String(raw ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

export interface CheckoutResult {
  checkoutId: string;
  equipmentId: string;
  name: string;
  quantity: number;
  onShelfAfter: number;
}

/**
 * Sjekker ut utstyr. Låser utstyrsraden først, slik at to som skanner samme
 * enhet samtidig ikke begge får den siste — samme kappløp som i
 * bookingtriggeren, og samme løsning.
 */
export async function checkOutEquipment(
  pool: Pool,
  input: {
    qrCode: string;
    projectId: string;
    checkedOutTo: string;
    checkedOutBy: string | null;
    quantity?: number;
    purpose?: string | null;
    via?: "qr" | "manual";
  },
): Promise<CheckoutResult> {
  const quantity = Math.floor(Number(input.quantity ?? 1));
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new CheckoutError("Antall må være minst 1.", "invalid_quantity");
  }
  const code = normalizeQrCode(input.qrCode);

  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    const eq = await client.query<{ id: string; name: string; quantity: number }>(
      `SELECT id, name, quantity FROM casting_equipment WHERE upper(qr_code) = $1 FOR UPDATE`,
      [code],
    );
    if (eq.rowCount === 0) {
      throw new CheckoutError(`Ukjent QR-kode: ${input.qrCode}`, "unknown_code");
    }
    const equipment = eq.rows[0];

    const out = await client.query<{ n: string }>(
      `SELECT COALESCE(SUM(quantity), 0) AS n
         FROM equipment_checkouts
        WHERE equipment_id = $1 AND checked_in_at IS NULL`,
      [equipment.id],
    );
    const checkedOut = Number(out.rows[0]?.n ?? 0);
    const stock = Number(equipment.quantity ?? 0);
    const onShelf = stock - checkedOut;

    if (onShelf < quantity) {
      throw new CheckoutError(
        `«${equipment.name}»: ${onShelf} av ${stock} står på lageret, forsøkte å hente ${quantity}.`,
        "none_available",
      );
    }

    const ins = await client.query<{ id: string }>(
      `INSERT INTO equipment_checkouts
         (equipment_id, project_id, checked_out_to, checked_out_by, quantity, purpose, checked_out_via)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        equipment.id, input.projectId, input.checkedOutTo, input.checkedOutBy,
        quantity, input.purpose ?? null, input.via ?? "qr",
      ],
    );

    await client.query("COMMIT");
    return {
      checkoutId: ins.rows[0].id,
      equipmentId: equipment.id,
      name: equipment.name,
      quantity,
      onShelfAfter: onShelf - quantity,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export interface CheckinResult {
  checkoutId: string;
  equipmentId: string;
  name: string;
  onShelfAfter: number;
}

/**
 * Sjekker inn igjen. Uten oppgitt checkoutId lukkes den eldste åpne
 * utsjekkingen — den som har vært ute lengst er nesten alltid den som
 * leveres, og å kreve en id ville betydd at innleveringen ikke ble registrert.
 */
export async function checkInEquipment(
  pool: Pool,
  input: {
    qrCode: string;
    checkoutId?: string | null;
    checkedInBy: string | null;
    conditionOnReturn?: string | null;
    via?: "qr" | "manual";
  },
): Promise<CheckinResult> {
  const code = normalizeQrCode(input.qrCode);

  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    const eq = await client.query<{ id: string; name: string; quantity: number }>(
      `SELECT id, name, quantity FROM casting_equipment WHERE upper(qr_code) = $1 FOR UPDATE`,
      [code],
    );
    if (eq.rowCount === 0) {
      throw new CheckoutError(`Ukjent QR-kode: ${input.qrCode}`, "unknown_code");
    }
    const equipment = eq.rows[0];

    const target = input.checkoutId
      ? await client.query<{ id: string }>(
          `SELECT id FROM equipment_checkouts
            WHERE id = $1 AND equipment_id = $2 AND checked_in_at IS NULL LIMIT 1`,
          [input.checkoutId, equipment.id],
        )
      : await client.query<{ id: string }>(
          `SELECT id FROM equipment_checkouts
            WHERE equipment_id = $1 AND checked_in_at IS NULL
            ORDER BY checked_out_at LIMIT 1`,
          [equipment.id],
        );

    if (target.rowCount === 0) {
      throw new CheckoutError(
        `«${equipment.name}» står ikke som utsjekket.`,
        "not_checked_out",
      );
    }

    await client.query(
      `UPDATE equipment_checkouts
          SET checked_in_at = NOW(), checked_in_by = $2,
              condition_on_return = COALESCE($3, condition_on_return),
              checked_in_via = $4
        WHERE id = $1`,
      [target.rows[0].id, input.checkedInBy, input.conditionOnReturn ?? null, input.via ?? "qr"],
    );

    const out = await client.query<{ n: string }>(
      `SELECT COALESCE(SUM(quantity), 0) AS n
         FROM equipment_checkouts
        WHERE equipment_id = $1 AND checked_in_at IS NULL`,
      [equipment.id],
    );

    await client.query("COMMIT");
    return {
      checkoutId: target.rows[0].id,
      equipmentId: equipment.id,
      name: equipment.name,
      onShelfAfter: Math.max(Number(equipment.quantity ?? 0) - Number(out.rows[0]?.n ?? 0), 0),
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
