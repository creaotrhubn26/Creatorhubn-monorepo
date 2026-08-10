import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  ROLE_STATUSES,
  ROLE_PIPELINE,
  ROLE_STATUS_LABELS,
  allowedTransitions,
  canTransition,
  getProjectPipeline,
  isRoleStatus,
  setRoleStatus,
  RoleStatusError,
} from "./role-room-role-status-service.js";

describe("vokabular", () => {
  it("har norsk etikett for hver status", () => {
    for (const s of ROLE_STATUSES) {
      expect(ROLE_STATUS_LABELS[s], `mangler etikett for ${s}`).toBeTruthy();
    }
  });

  it("pipelinen er delmengde av vokabularet, i rekkefølge", () => {
    for (const s of ROLE_PIPELINE) expect(ROLE_STATUSES).toContain(s);
    expect(ROLE_PIPELINE[0]).toBe("draft");
    expect(ROLE_PIPELINE[ROLE_PIPELINE.length - 1]).toBe("signed");
  });

  it("isRoleStatus avviser ukjente verdier", () => {
    expect(isRoleStatus("open")).toBe(true);
    expect(isRoleStatus("utlyst")).toBe(false);
    expect(isRoleStatus(null)).toBe(false);
  });
});

describe("overganger", () => {
  it("går framover ett steg av gangen gjennom hele trakta", () => {
    for (let i = 0; i < ROLE_PIPELINE.length - 1; i++) {
      expect(
        canTransition(ROLE_PIPELINE[i], ROLE_PIPELINE[i + 1]),
        `${ROLE_PIPELINE[i]} → ${ROLE_PIPELINE[i + 1]} burde vært lov`,
      ).toBe(true);
    }
  });

  it("hindrer at casting hoppes over", () => {
    // Hopper man rett til signert, er gjennomløpstallene verdiløse.
    expect(canTransition("draft", "signed")).toBe(false);
    expect(canTransition("draft", "offered")).toBe(false);
    expect(canTransition("open", "signed")).toBe(false);
  });

  it("tillater å gå ett steg tilbake", () => {
    // Kandidaten trakk seg, tilbudet ble avslått.
    expect(canTransition("offered", "shortlisted")).toBe(true);
    expect(canTransition("auditioning", "open")).toBe(true);
  });

  it("lar alle aktive steg gå til på vent og avlyst", () => {
    for (const s of ["open", "auditioning", "shortlisted", "offered"] as const) {
      expect(canTransition(s, "on_hold"), `${s} → on_hold`).toBe(true);
      expect(canTransition(s, "cancelled"), `${s} → cancelled`).toBe(true);
    }
  });

  it("lar en rolle på vent gjenopptas der den var", () => {
    expect(canTransition("on_hold", "shortlisted")).toBe(true);
    expect(canTransition("on_hold", "offered")).toBe(true);
  });

  it("lar en avlyst rolle gjenåpnes, men fra starten", () => {
    expect(canTransition("cancelled", "draft")).toBe(true);
    expect(canTransition("cancelled", "open")).toBe(true);
    // Ikke rett tilbake til slutten av trakta.
    expect(canTransition("cancelled", "signed")).toBe(false);
  });

  it("lar signert falle bort — kontrakter ryker", () => {
    expect(canTransition("signed", "cancelled")).toBe(true);
  });

  it("er idempotent for samme status", () => {
    for (const s of ROLE_STATUSES) expect(canTransition(s, s)).toBe(true);
  });

  it("hver status har minst én vei videre", () => {
    for (const s of ROLE_STATUSES) {
      expect(allowedTransitions(s).length, `${s} er en blindvei`).toBeGreaterThan(0);
    }
  });
});

// ── setRoleStatus ───────────────────────────────────────────────────────────

function stubPool(currentStatus: string | null) {
  const queries: string[] = [];
  const client = {
    query: vi.fn(async (sql: string) => {
      queries.push(sql);
      if (sql.includes("FOR UPDATE")) {
        return currentStatus === null
          ? { rows: [], rowCount: 0 }
          : { rows: [{ status: currentStatus, project_id: "p1" }], rowCount: 1 };
      }
      if (sql.includes("UPDATE casting_roles")) {
        return { rows: [{ status_changed_at: "2026-08-01T00:00:00Z" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };
  return { pool: { connect: async () => client } as unknown as Pool, client, queries };
}

describe("setRoleStatus", () => {
  it("flytter rollen og logger overgangen", async () => {
    const { pool, queries } = stubPool("open");
    const out = await setRoleStatus(pool, { roleId: "r1", toStatus: "auditioning", userId: "u1" });
    expect(out).toMatchObject({ from: "open", to: "auditioning" });
    expect(queries.some((q) => q.includes("INSERT INTO role_room_role_status_history"))).toBe(true);
    expect(queries.some((q) => q.includes("COMMIT"))).toBe(true);
  });

  it("logger ikke når statusen er uendret", async () => {
    // Ellers ville historikken fylles med overganger som ikke skjedde.
    const { pool, queries } = stubPool("open");
    await setRoleStatus(pool, { roleId: "r1", toStatus: "open", userId: "u1" });
    expect(queries.some((q) => q.includes("INSERT INTO role_room_role_status_history"))).toBe(false);
  });

  it("avviser ulovlig overgang og ruller tilbake", async () => {
    const { pool, queries } = stubPool("draft");
    await expect(
      setRoleStatus(pool, { roleId: "r1", toStatus: "signed", userId: "u1" }),
    ).rejects.toMatchObject({ code: "illegal_transition" });
    expect(queries.some((q) => q.includes("ROLLBACK"))).toBe(true);
  });

  it("nevner mulige neste steg i feilmeldingen", async () => {
    const { pool } = stubPool("draft");
    await expect(
      setRoleStatus(pool, { roleId: "r1", toStatus: "signed", userId: "u1" }),
    ).rejects.toThrow(/Utlyst/);
  });

  it("avviser ukjent status før den rører databasen", async () => {
    const { pool, client } = stubPool("open");
    await expect(
      setRoleStatus(pool, { roleId: "r1", toStatus: "tullestatus", userId: "u1" }),
    ).rejects.toMatchObject({ code: "unknown_status" });
    expect(client.query).not.toHaveBeenCalled();
  });

  it("gir not_found for ukjent rolle", async () => {
    const { pool } = stubPool(null);
    await expect(
      setRoleStatus(pool, { roleId: "nope", toStatus: "open", userId: "u1" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("låser raden så samtidige endringer serialiseres", async () => {
    const { pool, queries } = stubPool("open");
    await setRoleStatus(pool, { roleId: "r1", toStatus: "auditioning", userId: "u1" });
    expect(queries.some((q) => q.includes("FOR UPDATE"))).toBe(true);
  });

  it("setter opened_at og signed_at kun første gang", async () => {
    const { pool, queries } = stubPool("offered");
    await setRoleStatus(pool, { roleId: "r1", toStatus: "signed", userId: "u1" });
    const update = queries.find((q) => q.includes("UPDATE casting_roles"))!;
    expect(update).toContain("COALESCE(opened_at, NOW())");
    expect(update).toContain("COALESCE(signed_at, NOW())");
  });

  it("behandler ugyldig lagret status som draft framfor å kaste", async () => {
    // Rader fra før vokabularet kan inneholde hva som helst.
    const { pool } = stubPool("noe-rart");
    const out = await setRoleStatus(pool, { roleId: "r1", toStatus: "open", userId: "u1" });
    expect(out.from).toBe("draft");
  });
});

describe("getProjectPipeline", () => {
  it("tar med tomme steg — et hull i trakta er nettopp det man vil se", async () => {
    const pool = {
      query: vi.fn(async () => ({
        rows: [{ status: "open", n: "3" }, { status: "signed", n: "1" }],
        rowCount: 2,
      })),
    } as unknown as Pool;

    const out = await getProjectPipeline(pool, "p1");
    expect(out.pipeline).toHaveLength(ROLE_STATUSES.length);
    expect(out.pipeline.find((p) => p.status === "open")?.count).toBe(3);
    expect(out.pipeline.find((p) => p.status === "auditioning")?.count).toBe(0);
    expect(out.total).toBe(4);
  });
});

describe("RoleStatusError", () => {
  it("bærer en maskinlesbar kode", () => {
    expect(new RoleStatusError("x", "not_found").code).toBe("not_found");
  });
});
