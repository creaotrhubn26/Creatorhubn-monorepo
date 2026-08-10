import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  checkEquipmentAvailability,
  isOverbookingError,
  EQUIPMENT_OVERBOOK_ERRCODE,
} from "./role-room-equipment-availability.js";

/** Pool-stubb: første kall er utstyrsoppslaget, andre er konfliktsøket. */
function stubPool(
  equipment: Array<{ name: string; quantity: number }>,
  conflicts: Array<{ quantity: number }> = [],
) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("FROM casting_equipment")) {
      return { rows: equipment, rowCount: equipment.length };
    }
    return { rows: conflicts, rowCount: conflicts.length };
  });
  return { pool: { query } as unknown as Pool, query };
}

const req = { equipmentId: "e1", startDate: "2026-08-01", endDate: "2026-08-05" };

describe("checkEquipmentAvailability", () => {
  it("melder ledig når ingenting overlapper", async () => {
    const { pool } = stubPool([{ name: "Kamera", quantity: 1 }], []);
    const out = await checkEquipmentAvailability(pool, req);
    expect(out).toMatchObject({ stock: 1, bookedInPeriod: 0, available: 1, isAvailable: true });
  });

  it("trekker fra booket antall i perioden", async () => {
    const { pool } = stubPool([{ name: "Lyskaster", quantity: 5 }], [{ quantity: 3 }, { quantity: 1 }]);
    const out = await checkEquipmentAvailability(pool, { ...req, quantity: 1 });
    expect(out.bookedInPeriod).toBe(4);
    expect(out.available).toBe(1);
    expect(out.isAvailable).toBe(true);
  });

  it("melder opptatt når forespurt antall overstiger det ledige", async () => {
    const { pool } = stubPool([{ name: "Lyskaster", quantity: 5 }], [{ quantity: 4 }]);
    const out = await checkEquipmentAvailability(pool, { ...req, quantity: 2 });
    expect(out.available).toBe(1);
    expect(out.isAvailable).toBe(false);
  });

  it("er ledig når forespurt antall er nøyaktig det som er igjen", async () => {
    const { pool } = stubPool([{ name: "Lyskaster", quantity: 5 }], [{ quantity: 3 }]);
    expect((await checkEquipmentAvailability(pool, { ...req, quantity: 2 })).isAvailable).toBe(true);
  });

  it("lar ikke ledig antall bli negativt selv ved overbooket historikk", async () => {
    // Rader fra før sperren ble innført kan overstige lageret.
    const { pool } = stubPool([{ name: "Kamera", quantity: 1 }], [{ quantity: 3 }]);
    const out = await checkEquipmentAvailability(pool, req);
    expect(out.available).toBe(0);
    expect(out.isAvailable).toBe(false);
  });

  it("bruker halvåpne intervaller, som triggeren", async () => {
    const { pool, query } = stubPool([{ name: "Kamera", quantity: 1 }]);
    await checkEquipmentAvailability(pool, req);
    const sql = query.mock.calls[1][0] as string;
    // '[)' gjør at rygg-mot-rygg-utleie ikke regnes som konflikt.
    expect(sql).toContain("'[)'");
    expect(sql).toContain("status <> 'cancelled'");
  });

  it("kan utelate en eksisterende booking (når den flyttes)", async () => {
    const { pool, query } = stubPool([{ name: "Kamera", quantity: 1 }]);
    await checkEquipmentAvailability(pool, { ...req, excludeBookingId: "b1" });
    expect(query.mock.calls[1][1]).toContain("b1");
  });

  it("defaulter antall til 1 ved ugyldig verdi", async () => {
    const { pool } = stubPool([{ name: "Kamera", quantity: 1 }]);
    expect((await checkEquipmentAvailability(pool, { ...req, quantity: 0 })).requested).toBe(1);
    expect((await checkEquipmentAvailability(pool, { ...req, quantity: -4 })).requested).toBe(1);
  });

  it("kaster for ukjent utstyr", async () => {
    const { pool } = stubPool([]);
    await expect(checkEquipmentAvailability(pool, req)).rejects.toThrow(/Ukjent utstyr/);
  });
});

describe("isOverbookingError", () => {
  it("kjenner igjen triggerens feil", () => {
    expect(
      isOverbookingError({ code: EQUIPMENT_OVERBOOK_ERRCODE, message: "Dobbeltbooking av «Kamera A»: 1 av 1" }),
    ).toBe(true);
  });

  it("forveksler ikke med andre check-brudd", () => {
    // Samme feilkode, annen constraint — skal ikke bli 409 «opptatt».
    expect(
      isOverbookingError({ code: EQUIPMENT_OVERBOOK_ERRCODE, message: 'violates check constraint "equipment_bookings_date_order"' }),
    ).toBe(false);
  });

  it("takler tomme og fremmede feil", () => {
    expect(isOverbookingError(null)).toBe(false);
    expect(isOverbookingError(new Error("noe annet"))).toBe(false);
  });
});
