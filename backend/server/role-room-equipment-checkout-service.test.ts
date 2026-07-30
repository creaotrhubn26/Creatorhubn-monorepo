import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  CheckoutError,
  checkInEquipment,
  checkOutEquipment,
  getEquipmentByCode,
  normalizeQrCode,
} from "./role-room-equipment-checkout-service.js";

describe("normalizeQrCode", () => {
  it("tåler at koden tastes inn for hånd når merket er slitt", () => {
    expect(normalizeQrCode(" rr-abc123 ")).toBe("RR-ABC123");
    expect(normalizeQrCode("RR ABC 123")).toBe("RRABC123");
  });

  it("takler tom og udefinert verdi", () => {
    expect(normalizeQrCode("")).toBe("");
    expect(normalizeQrCode(undefined as unknown as string)).toBe("");
  });
});

function stubRead(equipment: unknown[], outstanding: unknown[] = []) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("FROM casting_equipment")) {
      return { rows: equipment, rowCount: equipment.length };
    }
    return { rows: outstanding, rowCount: outstanding.length };
  });
  return { pool: { query } as unknown as Pool, query };
}

describe("getEquipmentByCode", () => {
  const eq = [{ id: "e1", name: "Kamera A", quantity: 3, qr_code: "RR-ABC" }];

  it("summerer hvor enhetene er", async () => {
    const { pool } = stubRead(eq, [{ quantity: 2 }]);
    const out = await getEquipmentByCode(pool, "RR-ABC");
    expect(out).toMatchObject({ stock: 3, checkedOut: 2, onShelf: 1 });
  });

  it("lar ikke hyllebeholdningen bli negativ", async () => {
    // Historiske rader kan overstige beholdningen.
    const { pool } = stubRead(eq, [{ quantity: 9 }]);
    expect((await getEquipmentByCode(pool, "RR-ABC")).onShelf).toBe(0);
  });

  it("kaster på ukjent kode", async () => {
    const { pool } = stubRead([]);
    await expect(getEquipmentByCode(pool, "RR-NOPE")).rejects.toMatchObject({ code: "unknown_code" });
  });

  it("kaster på tom kode uten å spørre databasen", async () => {
    const { pool, query } = stubRead(eq);
    await expect(getEquipmentByCode(pool, "  ")).rejects.toMatchObject({ code: "unknown_code" });
    expect(query).not.toHaveBeenCalled();
  });
});

function stubTx(opts: {
  equipment?: Array<Record<string, unknown>>;
  checkedOut?: number;
  openCheckouts?: Array<{ id: string }>;
}) {
  const queries: string[] = [];
  const client = {
    query: vi.fn(async (sql: string) => {
      queries.push(sql);
      if (sql.includes("FROM casting_equipment")) {
        const rows = opts.equipment ?? [{ id: "e1", name: "Kamera A", quantity: 1 }];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("COALESCE(SUM(quantity)")) {
        return { rows: [{ n: String(opts.checkedOut ?? 0) }], rowCount: 1 };
      }
      if (sql.includes("SELECT id FROM equipment_checkouts")) {
        const rows = opts.openCheckouts ?? [];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("INSERT INTO equipment_checkouts")) {
        return { rows: [{ id: "co1" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };
  return { pool: { connect: async () => client } as unknown as Pool, client, queries };
}

describe("checkOutEquipment", () => {
  const base = { qrCode: "RR-ABC", projectId: "p1", checkedOutTo: "Foto", checkedOutBy: "u1" };

  it("sjekker ut når det står noe på lageret", async () => {
    const { pool } = stubTx({ checkedOut: 0 });
    const out = await checkOutEquipment(pool, base);
    expect(out).toMatchObject({ checkoutId: "co1", quantity: 1, onShelfAfter: 0 });
  });

  it("nekter når alt er ute", async () => {
    const { pool } = stubTx({ checkedOut: 1 });
    await expect(checkOutEquipment(pool, base)).rejects.toMatchObject({ code: "none_available" });
  });

  it("sier hvor mange som faktisk står igjen", async () => {
    const { pool } = stubTx({ equipment: [{ id: "e1", name: "Lyskaster", quantity: 3 }], checkedOut: 2 });
    await expect(checkOutEquipment(pool, { ...base, quantity: 2 })).rejects.toThrow(/1 av 3/);
  });

  it("tillater å hente nøyaktig det som er igjen", async () => {
    const { pool } = stubTx({ equipment: [{ id: "e1", name: "Lyskaster", quantity: 3 }], checkedOut: 1 });
    expect((await checkOutEquipment(pool, { ...base, quantity: 2 })).onShelfAfter).toBe(0);
  });

  it("låser utstyrsraden mot samtidig skanning", async () => {
    // Samme kappløp som i bookingtriggeren — to som skanner siste enhet.
    const { pool, queries } = stubTx({ checkedOut: 0 });
    await checkOutEquipment(pool, base);
    expect(queries.some((q) => q.includes("FOR UPDATE"))).toBe(true);
  });

  it("avviser ugyldig antall", async () => {
    const { pool } = stubTx({});
    await expect(checkOutEquipment(pool, { ...base, quantity: 0 })).rejects.toMatchObject({
      code: "invalid_quantity",
    });
    await expect(checkOutEquipment(pool, { ...base, quantity: -2 })).rejects.toMatchObject({
      code: "invalid_quantity",
    });
  });

  it("ruller tilbake på ukjent kode", async () => {
    const { pool, queries } = stubTx({ equipment: [] });
    await expect(checkOutEquipment(pool, base)).rejects.toMatchObject({ code: "unknown_code" });
    expect(queries.some((q) => q.includes("ROLLBACK"))).toBe(true);
  });

  it("registrerer at utsjekkingen skjedde via skanning", async () => {
    const { pool, client } = stubTx({ checkedOut: 0 });
    await checkOutEquipment(pool, base);
    const insert = client.query.mock.calls.find((c) => String(c[0]).includes("INSERT INTO equipment_checkouts"))!;
    expect((insert[1] as unknown[])[6]).toBe("qr");
  });
});

describe("checkInEquipment", () => {
  const base = { qrCode: "RR-ABC", checkedInBy: "u1" };

  it("lukker den eldste åpne utsjekkingen når ingen id er oppgitt", async () => {
    // Å kreve id ville betydd at innleveringen ikke ble registrert.
    const { pool, queries } = stubTx({ openCheckouts: [{ id: "co1" }], checkedOut: 0 });
    const out = await checkInEquipment(pool, base);
    expect(out.checkoutId).toBe("co1");
    expect(queries.some((q) => q.includes("ORDER BY checked_out_at LIMIT 1"))).toBe(true);
  });

  it("kan lukke en bestemt utsjekking", async () => {
    const { pool, queries } = stubTx({ openCheckouts: [{ id: "co9" }], checkedOut: 0 });
    await checkInEquipment(pool, { ...base, checkoutId: "co9" });
    expect(queries.some((q) => q.includes("WHERE id = $1 AND equipment_id = $2"))).toBe(true);
  });

  it("nekter når ingenting står som utsjekket", async () => {
    const { pool } = stubTx({ openCheckouts: [] });
    await expect(checkInEquipment(pool, base)).rejects.toMatchObject({ code: "not_checked_out" });
  });

  it("kaster på ukjent kode", async () => {
    const { pool } = stubTx({ equipment: [] });
    await expect(checkInEquipment(pool, base)).rejects.toMatchObject({ code: "unknown_code" });
  });
});

describe("CheckoutError", () => {
  it("bærer en maskinlesbar kode så ruter kan svare 409 framfor 500", () => {
    expect(new CheckoutError("x", "none_available").code).toBe("none_available");
  });
});
