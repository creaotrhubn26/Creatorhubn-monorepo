import { describe, expect, it } from "vitest";

import { AI_REFERRAL_SOURCES, toAiReferralSignals } from "./owned-channels-signal-sync.js";
import { normalizeGa4RunReport } from "./ga4-signal-normalizer.js";
import { validateNormalizedSignal } from "./normalized-signal-schema.js";

const CTX = {
  organizationId: "8f14e45f-ceea-467f-a8db-000000000001",
  workspaceId: "user-1",
  propertyId: "properties/123",
  periodStart: "2026-06-13T00:00:00.000Z",
  periodEnd: "2026-07-10T23:59:59.999Z",
  collectedAt: "2026-07-11T04:45:00.000Z",
};

describe("toAiReferralSignals", () => {
  const report = {
    dimensionHeaders: [{ name: "sessionSource" }],
    metricHeaders: [{ name: "sessions" }],
    rows: [
      { dimensionValues: [{ value: "chatgpt.com" }], metricValues: [{ value: "42" }] },
      { dimensionValues: [{ value: "perplexity.ai" }], metricValues: [{ value: "7" }] },
    ],
  };

  it("remaps sessions → ai_referral_sessions with clean source topics", () => {
    const { signals } = normalizeGa4RunReport(report, CTX);
    const ai = toAiReferralSignals(signals);
    expect(ai).toHaveLength(2);
    expect(ai.map((s) => s.topic).sort()).toEqual(["chatgpt.com", "perplexity.ai"]);
    for (const s of ai) {
      expect(s.metricType).toBe("ai_referral_sessions");
      expect(s.id).toContain("ai_referral_sessions");
      expect(s.isEstimated).toBe(false); // ekte GA4-data, ikke syntetisk
      expect(validateNormalizedSignal(s).errors, s.id).toBeUndefined();
    }
    expect(ai.find((s) => s.topic === "chatgpt.com")?.metricValue).toBe(42);
  });

  it("keeps deterministic distinct ids per source (idempotent re-sync)", () => {
    const { signals } = normalizeGa4RunReport(report, CTX);
    const a = toAiReferralSignals(signals).map((s) => s.id);
    const b = toAiReferralSignals(normalizeGa4RunReport(report, CTX).signals).map((s) => s.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it("ignores non-session metrics", () => {
    const { signals } = normalizeGa4RunReport(
      {
        metricHeaders: [{ name: "conversions" }],
        rows: [{ metricValues: [{ value: "3" }] }],
      },
      CTX,
    );
    expect(toAiReferralSignals(signals)).toEqual([]);
  });

  it("tracks the AI sources we care about", () => {
    expect(AI_REFERRAL_SOURCES).toContain("chatgpt.com");
    expect(AI_REFERRAL_SOURCES).toContain("perplexity.ai");
    expect(AI_REFERRAL_SOURCES).toContain("claude.ai");
  });
});
