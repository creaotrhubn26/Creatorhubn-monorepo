import { describe, expect, it, vi } from "vitest";

import {
  releaseTransition,
  runReleaseMonitor,
  type ReleaseWatchDef,
} from "./control-center-release-monitor.js";

describe("releaseTransition", () => {
  it("aldri sett → baseline (uten varsel)", () => {
    expect(releaseTransition(null, null, "v1.0")).toBe("baseline");
  });
  it("uendret versjon → none", () => {
    expect(releaseTransition("v1.0", "v1.0", "v1.0")).toBe("none");
  });
  it("ny versjon → notify", () => {
    expect(releaseTransition("v1.0", "v1.0", "v1.1")).toBe("notify");
  });
  it("varsel feilet forrige gang (lastNotified henger etter) → notify igjen", () => {
    // versjon ble lagret som v1.1, men varselet nådde aldri fram (lastNotified v1.0)
    expect(releaseTransition("v1.1", "v1.0", "v1.1")).toBe("notify");
  });
  it("lastNotified null men versjon finnes (pre-migrasjons-rad) → notify ved endring", () => {
    expect(releaseTransition("v1.0", null, "v1.1")).toBe("notify");
    expect(releaseTransition("v1.0", null, "v1.0")).toBe("none");
  });
});

// ── runReleaseMonitor integrasjon (injisert watch/pool/spies) ────────────────

function makeFakePool(prevRows: Record<string, { version: string; last_notified_version: string | null }>) {
  const upserts: unknown[][] = [];
  const pool = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("SELECT version")) {
        const key = params?.[0] as string;
        const row = prevRows[key];
        return { rows: row ? [{ version: row.version, url: null, last_notified_version: row.last_notified_version }] : [] };
      }
      if (sql.includes("INSERT INTO control_center_release_status")) {
        upserts.push(params ?? []);
        return { rows: [] };
      }
      return { rows: [] };
    }),
  };
  return { pool, upserts };
}

function watch(key: string, run: ReleaseWatchDef["run"]): ReleaseWatchDef {
  return { key, label: key, run };
}

describe("runReleaseMonitor", () => {
  it("første kjøring → baseline, ingen varsel", async () => {
    const { pool, upserts } = makeFakePool({});
    const notifyFn = vi.fn(async () => {});
    const summary = await runReleaseMonitor(pool as never, {
      notifyFn,
      watches: [watch("a", async () => ({ version: "v1.0", url: "u" }))],
    });
    expect(summary.updated).toBe(0);
    expect(notifyFn).not.toHaveBeenCalled();
    // baseline lagrer last_notified_version = fetched (ingen etterslep-varsel)
    expect(upserts[0]).toContain("v1.0");
  });

  it("ny versjon → varsel + oppdatert last_notified", async () => {
    const { pool, upserts } = makeFakePool({ a: { version: "v1.0", last_notified_version: "v1.0" } });
    const notifyFn = vi.fn(async () => {});
    const summary = await runReleaseMonitor(pool as never, {
      notifyFn,
      watches: [watch("a", async () => ({ version: "v1.1", url: "u" }))],
    });
    expect(summary.updated).toBe(1);
    expect(notifyFn).toHaveBeenCalledTimes(1);
    const lastParams = upserts[0] as string[];
    expect(lastParams).toContain("v1.1"); // version
    expect(lastParams[lastParams.length - 1]).toBe("v1.1"); // last_notified_version
  });

  it("notify-feil → last_notified beholdes (retry neste kjøring)", async () => {
    const { pool, upserts } = makeFakePool({ a: { version: "v1.0", last_notified_version: "v1.0" } });
    const notifyFn = vi.fn(async () => {
      throw new Error("smtp down");
    });
    await runReleaseMonitor(pool as never, {
      notifyFn,
      watches: [watch("a", async () => ({ version: "v1.1", url: "u" }))],
    });
    const lastParams = upserts[0] as (string | null)[];
    expect(lastParams[lastParams.length - 1]).toBe("v1.0"); // uendret → transisjonen trigges igjen
  });

  it("hentefeil → status error, ingen varsel, versjon urørt", async () => {
    const { pool, upserts } = makeFakePool({ a: { version: "v1.0", last_notified_version: "v1.0" } });
    const notifyFn = vi.fn(async () => {});
    const summary = await runReleaseMonitor(pool as never, {
      notifyFn,
      watches: [
        watch("a", async () => {
          throw new Error("HTTP 503");
        }),
      ],
    });
    expect(summary.errors).toBe(1);
    expect(notifyFn).not.toHaveBeenCalled();
    const lastParams = upserts[0] as (string | null)[];
    expect(lastParams).toContain("v1.0"); // beholdt versjon
    expect(lastParams).toContain("error");
  });

  it("manglende tabell (42P01) → grasiøs baseline-oppførsel uten kast", async () => {
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("SELECT version")) {
          const err = new Error("relation does not exist") as Error & { code: string };
          err.code = "42P01";
          throw err;
        }
        return { rows: [] };
      }),
    };
    const notifyFn = vi.fn(async () => {});
    const summary = await runReleaseMonitor(pool as never, {
      notifyFn,
      watches: [watch("a", async () => ({ version: "v1.0", url: null }))],
    });
    expect(summary.ran).toBe(1);
    expect(notifyFn).not.toHaveBeenCalled();
  });
});
