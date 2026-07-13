import { describe, expect, it, vi } from "vitest";

import { mapRiskStatus, RISK_LABELS } from "./konkurs-watch.js";
import { INSIGHT_DETECTORS } from "./insight-engine.js";

describe("mapRiskStatus (registerflagg → risiko)", () => {
  it("konkurs vinner over avvikling; friske selskaper gir null", () => {
    expect(mapRiskStatus({ konkurs: true, underAvvikling: true })).toBe("bankrupt");
    expect(mapRiskStatus({ underTvangsavviklingEllerTvangsopplosning: true })).toBe("forced_liquidation");
    expect(mapRiskStatus({ underAvvikling: true })).toBe("liquidation");
    expect(mapRiskStatus({ navn: "Frisk AS" })).toBeNull();
  });

  it("alle statuser har norsk etikett", () => {
    expect(Object.keys(RISK_LABELS)).toHaveLength(3);
  });
});

describe("sales-trigger-detektoren håndterer 'risk'", () => {
  const detector = INSIGHT_DETECTORS.find((d) => d.detectorKey === "sales-trigger")!;

  it("risk = critical med RISIKO-tittel og register-forklaring", async () => {
    const rows = [{
      source: "brreg", event_id: "999888777|bankrupt", kind: "risk",
      title: "Kunde AS er KONKURS", url: "https://virksomhet.brreg.no/nb/oppslag/enheter/999888777",
      published_at: "2026-07-13", matched_topic: "Kunde AS", raw: { orgNr: "999888777", status: "bankrupt" },
    }];
    const pool = { query: vi.fn(async () => ({ rows, rowCount: 1 })) } as unknown as import("pg").Pool;
    const [insight] = await detector.run(pool, "org-1");
    expect(insight.severity).toBe("critical");
    expect(insight.title).toBe("RISIKO: Kunde AS er KONKURS");
    expect(insight.explanation).toContain("registerfakta");
    expect(insight.dedupeKey).toBe("trigger|brreg|999888777|bankrupt");
  });
});
