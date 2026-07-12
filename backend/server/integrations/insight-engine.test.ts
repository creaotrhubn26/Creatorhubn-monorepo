import { describe, expect, it, vi } from "vitest";

import {
  changeConfidence,
  INSIGHT_DETECTORS,
  pctChange,
  runInsightDetectors,
  severityFromChange,
} from "./insight-engine.js";

describe("stat-hjelpere", () => {
  it("pctChange handles normal and zero-baseline cases", () => {
    expect(pctChange(10, 15)).toBe(50);
    expect(pctChange(20, 10)).toBe(-50);
    expect(pctChange(0, 5)).toBeNull(); // udefinert → «ny», ikke uendelig
  });

  it("changeConfidence grows with sample size and magnitude, capped at 0.95", () => {
    const small = changeConfidence(3, 50);
    const large = changeConfidence(100, 50);
    expect(large).toBeGreaterThan(small);
    expect(changeConfidence(1000, 1000)).toBeLessThanOrEqual(0.95);
    expect(small).toBeGreaterThanOrEqual(0.3); // gulv — vi melder aldri med 0-konfidens
  });

  it("severityFromChange maps magnitude to honest levels", () => {
    expect(severityFromChange(20, false)).toBe("info");
    expect(severityFromChange(50, false)).toBe("notable");
    expect(severityFromChange(150, false)).toBe("important");
    expect(severityFromChange(300, false)).toBe("critical");
    expect(severityFromChange(null, true)).toBe("notable"); // «ny» er verdt å se
  });
});

describe("geo-sov-change-detektoren (min-utvalg-vakter)", () => {
  const detector = INSIGHT_DETECTORS.find((d) => d.detectorKey === "geo-sov-change")!;

  function poolWith(rows: unknown[]) {
    return { query: vi.fn(async () => ({ rows, rowCount: rows.length })) } as unknown as import("pg").Pool;
  }

  const base = {
    provider: "geo-probe-anthropic",
    subject_id: "Spotlight",
    topic: "Norge:anthropic",
    curr_id: "sig-1",
    curr_collected: "2026-07-13T06:00:00Z",
  };

  it("melder vesentlig endring med evidens og deterministisk dedupe-key", async () => {
    const out = await detector.run(poolWith([{ ...base, curr: 7, prev: 3 }]), "org-1");
    expect(out).toHaveLength(1);
    expect(out[0].title).toContain("3 → 7");
    expect(out[0].evidence.length).toBeGreaterThan(0);
    expect(out[0].dedupeKey).toBe("geo-sov|geo-probe-anthropic|Spotlight|Norge:anthropic|2026-07-13");
  });

  it("tier stille under min-delta (støy ved n≈25)", async () => {
    const out = await detector.run(poolWith([{ ...base, curr: 3, prev: 2 }]), "org-1");
    expect(out).toEqual([]);
  });

  it("tier stille når begge målinger er under min-omtaler", async () => {
    // 0→1 og 1→0 er støy — men 0→2 melder (delta=2, max=2)
    expect(await detector.run(poolWith([{ ...base, curr: 1, prev: 0 }]), "org-1")).toEqual([]);
  });

  it("trenger to målinger (prev=null → ingen innsikt)", async () => {
    const out = await detector.run(poolWith([{ ...base, curr: 7, prev: null }]), "org-1");
    expect(out).toEqual([]);
  });
});

describe("runInsightDetectors", () => {
  it("én detektor-feil velter ikke motoren — rapporteres i errors", async () => {
    let call = 0;
    const pool = {
      query: vi.fn(async (sql: string) => {
        call++;
        if (call === 1) throw new Error("db-hikke i første detektor");
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as import("pg").Pool;

    const result = await runInsightDetectors(pool, "org-1");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("db-hikke");
    expect(result.detectorsRun).toBe(INSIGHT_DETECTORS.length - 1);
  });
});
