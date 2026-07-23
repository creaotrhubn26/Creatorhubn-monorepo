import { describe, expect, it, vi } from "vitest";

import { median, isSpike, runAnomalyScan } from "./control-center-anomaly.js";

describe("median", () => {
  it("oddetall", () => expect(median([3, 1, 2])).toBe(2));
  it("partall = snitt av midtre to", () => expect(median([1, 2, 3, 4])).toBe(2.5));
  it("tom → null", () => expect(median([])).toBeNull());
});

describe("isSpike", () => {
  it("ingen baseline → aldri spike", () => {
    expect(isSpike(1000, null)).toBe(false);
  });
  it("under min-terskel → ikke spike selv om >baseline", () => {
    expect(isSpike(5, 1, 3, 10)).toBe(false); // 5 < min 10
  });
  it("godt over baseline*factor og over min → spike", () => {
    expect(isSpike(50, 5, 3, 10)).toBe(true); // 50 > max(10, 15)
  });
  it("nær baseline → ikke spike", () => {
    expect(isSpike(20, 10, 3, 10)).toBe(false); // 20 < 30
  });
});

// ── runAnomalyScan integrasjon (fake pool) ──────────────────────────────────

/**
 * Fake-pool som svarer på de spesifikke spørringene runAnomalyScan gjør.
 * `histDeltas` styrer baseline; `prevTotal`/`curTotal` styrer delta; `newRows`
 * styrer nye feiltyper; `debounceAllows` styrer om varsel slipper gjennom.
 */
function makeFakePool(opts: {
  curTotal: number;
  active: number;
  unresolved: number;
  prevTotal: number | null;
  histDeltas: number[];
  newRows: Array<{ fingerprint: string; message: string }>;
  debounceAllows: boolean;
}) {
  const inserts: string[] = [];
  const pool = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("COALESCE(SUM(occurrence_count)")) {
        return { rows: [{ total: opts.curTotal, active: opts.active, unresolved: opts.unresolved }] };
      }
      if (sql.includes("SELECT total_occurrences FROM control_center_error_snapshots")) {
        return { rows: opts.prevTotal == null ? [] : [{ total_occurrences: opts.prevTotal }] };
      }
      if (sql.includes("SELECT delta_occurrences FROM control_center_error_snapshots")) {
        return { rows: opts.histDeltas.map((d) => ({ delta_occurrences: d })) };
      }
      if (sql.includes("INSERT INTO control_center_error_snapshots")) {
        inserts.push("snapshot");
        return { rows: [] };
      }
      if (sql.includes("FROM error_log") && sql.includes("first_seen_at")) {
        return { rows: opts.newRows.map((r) => ({ ...r, endpoint: "/x", level: "error", occurrence_count: 1, first_seen_at: new Date(0).toISOString() })) };
      }
      if (sql.includes("INSERT INTO control_center_anomaly_state")) {
        return { rowCount: opts.debounceAllows ? 1 : 0, rows: opts.debounceAllows ? [{ anomaly_key: "k" }] : [] };
      }
      return { rows: [] };
    }),
  };
  return { pool, inserts };
}

describe("runAnomalyScan", () => {
  it("spike over baseline → varsel (når debounce slipper)", async () => {
    const { pool, inserts } = makeFakePool({
      curTotal: 1000, active: 8, unresolved: 12,
      prevTotal: 900, // delta 100
      histDeltas: [5, 6, 4, 5], // baseline 5 → 100 > max(10, 15) = spike
      newRows: [],
      debounceAllows: true,
    });
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const summary = await runAnomalyScan(pool as never, { notifyFn });

    expect(summary.spike).toBe(true);
    expect(summary.deltaOccurrences).toBe(100);
    expect(summary.baseline).toBe(5);
    expect(inserts).toContain("snapshot"); // snapshot alltid lagret
    expect(notifyFn).toHaveBeenCalledTimes(1);
    expect(notifyFn.mock.calls[0][1].title).toContain("spike");
  });

  it("spike men debounce blokkerer → ingen varsel", async () => {
    const { pool } = makeFakePool({
      curTotal: 1000, active: 8, unresolved: 12, prevTotal: 900,
      histDeltas: [5, 6, 4, 5], newRows: [], debounceAllows: false,
    });
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const summary = await runAnomalyScan(pool as never, { notifyFn });
    expect(summary.spike).toBe(true);
    expect(notifyFn).not.toHaveBeenCalled();
  });

  it("ingen baseline (første snapshots) → ingen spike, ingen varsel", async () => {
    const { pool } = makeFakePool({
      curTotal: 1000, active: 8, unresolved: 12, prevTotal: null,
      histDeltas: [], newRows: [], debounceAllows: true,
    });
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const summary = await runAnomalyScan(pool as never, { notifyFn });
    expect(summary.spike).toBe(false);
    expect(summary.baseline).toBeNull();
    expect(notifyFn).not.toHaveBeenCalled();
  });

  it("ny feiltype → varsel per fingerprint (debounce slipper)", async () => {
    const { pool } = makeFakePool({
      curTotal: 100, active: 1, unresolved: 1, prevTotal: 100, // delta 0, ingen spike
      histDeltas: [0, 0], newRows: [{ fingerprint: "fp1", message: "Ny feil X" }],
      debounceAllows: true,
    });
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const summary = await runAnomalyScan(pool as never, { notifyFn });
    expect(summary.spike).toBe(false);
    expect(summary.newErrors).toHaveLength(1);
    expect(notifyFn).toHaveBeenCalledTimes(1);
    expect(notifyFn.mock.calls[0][1].title).toContain("Ny feiltype");
  });

  it("delta klemmes til 0 når total synker (resolve/rydding)", async () => {
    const { pool } = makeFakePool({
      curTotal: 800, active: 2, unresolved: 2, prevTotal: 900, // negativ → 0
      histDeltas: [10, 10], newRows: [], debounceAllows: true,
    });
    const summary = await runAnomalyScan(pool as never, { notifyFn: vi.fn() });
    expect(summary.deltaOccurrences).toBe(0);
    expect(summary.spike).toBe(false);
  });
});
