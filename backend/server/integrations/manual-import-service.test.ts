import { describe, expect, it } from "vitest";

import {
  detectGoogleTrendsCsv,
  googleTrendsToSignals,
  genericCsvToSignals,
  parseGoogleTrendsCsv,
  previewImport,
  suggestMapping,
} from "./manual-import-service.js";
import { validateNormalizedSignal } from "./normalized-signal-schema.js";

const META = {
  organizationId: "8f14e45f-ceea-467f-a8db-000000000001",
  workspaceOwnerUserId: "user-1",
  collectedAt: "2026-07-11T08:00:00.000Z",
};

const TRENDS_CSV = `Kategori: Alle kategorier

Uke,"leadgenerering: (Norge)","crm system: (Norge)"
2026-06-21,45,62
2026-06-28,<1,70
2026-07-05,52,`;

describe("Google Trends-preset", () => {
  it("detects the Trends export format (with preamble)", () => {
    expect(detectGoogleTrendsCsv(TRENDS_CSV)).toBe(true);
    expect(detectGoogleTrendsCsv("topic,value\nx,1")).toBe(false);
  });

  it("parses terms (stripped of ': (Norge)'), weeks and '<1' values", () => {
    const { terms, rows, granularity } = parseGoogleTrendsCsv(TRENDS_CSV);
    expect(terms).toEqual(["leadgenerering", "crm system"]);
    expect(granularity).toBe("week");
    expect(rows[1].values).toEqual([0, 70]); // '<1' → 0
    expect(rows[2].values).toEqual([52, null]); // tom celle → null
  });

  it("produces contract-valid relative_interest signals (Imported/Estimated)", () => {
    const { signals, rejectedRows } = googleTrendsToSignals(TRENDS_CSV, META);
    expect(rejectedRows).toBe(0);
    expect(signals).toHaveLength(5); // 6 celler - 1 tom
    for (const s of signals) {
      expect(validateNormalizedSignal(s).errors, s.id).toBeUndefined();
      expect(s.unit).toBe("relative_index"); // aldri searches_per_month
      expect(s.sourceType).toBe("manual_upload");
      expect(s.isEstimated).toBe(true);
    }
    const week = signals.find((s) => s.topic === "leadgenerering" && s.metricValue === 45)!;
    expect(week.periodStart).toBe("2026-06-21T00:00:00.000Z");
    expect(week.periodEnd).toBe("2026-06-27T23:59:59.999Z");
  });

  it("has deterministic ids so re-import is a no-op (dedup)", () => {
    const a = googleTrendsToSignals(TRENDS_CSV, META).signals.map((s) => s.id);
    const b = googleTrendsToSignals(TRENDS_CSV, META).signals.map((s) => s.id);
    expect(a).toEqual(b);
  });
});

describe("generisk CSV", () => {
  const CSV = `søkeord,dato,antall
dansestudio oslo,2026-07-01,120
,2026-07-02,50
casting verktøy,ugyldig-dato,30
selvtape,2026-07-03,ikke-tall`;

  it("suggests mapping from Norwegian header hints", () => {
    const mapping = suggestMapping(["søkeord", "dato", "antall"]);
    expect(mapping.topic).toBe("søkeord");
    expect(mapping.periodStart).toBe("dato");
    expect(mapping.metricValue).toBe("antall");
  });

  it("imports valid rows and rejects broken ones (never silently)", () => {
    const { signals, rejectedRows } = genericCsvToSignals(
      CSV,
      { topic: "søkeord", periodStart: "dato", metricValue: "antall", unit: "count" },
      META,
    );
    expect(signals).toHaveLength(1);
    expect(signals[0].topic).toBe("dansestudio oslo");
    expect(rejectedRows).toBe(3);
  });

  it("requires a complete mapping", () => {
    const r = genericCsvToSignals(CSV, { topic: "søkeord" }, META);
    expect(r.signals).toHaveLength(0);
    expect(r.errors[0]).toContain("mapping");
  });
});

describe("previewImport", () => {
  it("routes Trends-CSV to the preset with sample signals", () => {
    const p = previewImport(TRENDS_CSV, META);
    expect(p.preset).toBe("google-trends-csv");
    expect(p.rowCount).toBe(5);
    expect(p.sampleSignals.length).toBeGreaterThan(0);
  });

  it("routes generic CSV with suggested mapping", () => {
    const p = previewImport("søkeord,dato,antall\nx y,2026-07-01,5", META);
    expect(p.preset).toBe("generic");
    expect(p.suggestedMapping?.topic).toBe("søkeord");
    expect(p.rowCount).toBe(1);
  });
});
