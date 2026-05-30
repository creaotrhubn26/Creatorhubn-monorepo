import { describe, it, expect, afterEach } from "vitest";
import {
  buildRecommendationsSystemPrompt,
  buildRecommendationsUserMessage,
  parseRecommendationsJson,
  generateAdRecommendations,
  __setAdRecommendationsLlmClient,
  type RecommendationContext,
  type AdRecommendationsLlmClient,
} from "./role-room-ads-recommendations.js";

afterEach(() => __setAdRecommendationsLlmClient(null));

const baseCtx: RecommendationContext = {
  businessName: "MedInnova",
  industry: "helse",
  valueProp: "Tryggere og mer effektive legebesøk",
  period: "2026-05",
  channels: [
    { platform: "meta", spendNok: 25_000, impressions: 200_000, clicks: 4_200, conversions: 18, conversionValueNok: 120_000, ctr: 2.1, cpc: 5.95, roas: 4.8, costPerConversionNok: 1389 },
    { platform: "google", spendNok: 18_000, impressions: 80_000, clicks: 600, conversions: 12, conversionValueNok: 93_600, ctr: 0.75, cpc: 30, roas: 5.2, costPerConversionNok: 1500 },
    { platform: "linkedin", spendNok: 12_000, impressions: 24_000, clicks: 95, conversions: 2, conversionValueNok: 10_800, ctr: 0.4, cpc: 126, roas: 0.9, costPerConversionNok: 6000 },
    { platform: "total", spendNok: 55_000, impressions: 304_000, clicks: 4_895, conversions: 32, conversionValueNok: 224_400, ctr: 1.61, cpc: 11.24, roas: 4.08, costPerConversionNok: 1719 },
  ],
  budget: {
    hasBudget: true, maxSpendNok: 60_000, actualSpendNok: 55_000, utilizationPct: 91.7,
    daysInPeriod: 31, daysElapsed: 25, daysRemaining: 6,
    dailyRunRateNok: 2_200, projectedPeriodSpendNok: 68_200, projectedOverspendNok: 8_200,
    recommendedDailyBudgetNok: 833, projectedExhaustionDate: "2026-05-28", pace: "over_pace",
  },
  language: "no",
};

// ── System-prompt setter rammene ────────────────────────────────────────

describe("buildRecommendationsSystemPrompt", () => {
  it("describes the JSON schema with the allowed types and severities", () => {
    const p = buildRecommendationsSystemPrompt();
    expect(p).toContain("pause_underperformer");
    expect(p).toContain("reallocate_budget");
    expect(p).toContain("scale_winner");
    expect(p).toContain("refresh_creative");
    expect(p).toContain("fix_tracking");
    expect(p).toContain("critical");
  });

  it("requires evidence with specific numbers, not vague claims", () => {
    expect(buildRecommendationsSystemPrompt()).toMatch(/specific numbers/i);
  });

  it("guards against unverified medical/regulatory claims", () => {
    const p = buildRecommendationsSystemPrompt().toLowerCase();
    expect(p).toContain("clinical");
    expect(p).toContain("medical");
  });

  it("instructs to return empty array + overallNote when healthy", () => {
    expect(buildRecommendationsSystemPrompt()).toMatch(/empty array/i);
  });
});

// ── User-message threader budget + channels + previous period ───────────

describe("buildRecommendationsUserMessage", () => {
  it("renders a per-channel table with the actual numbers", () => {
    const m = buildRecommendationsUserMessage(baseCtx);
    expect(m).toContain("MedInnova");
    expect(m).toContain("| Channel |");
    expect(m).toMatch(/\| meta \|/);
    expect(m).toMatch(/\| linkedin \|/);
    expect(m).toContain("4,8"); // ROAS for meta
  });

  it("includes the budget pacing snapshot when budget is set", () => {
    const m = buildRecommendationsUserMessage(baseCtx);
    expect(m).toContain("Budget pacing");
    expect(m).toContain("over_pace");
    expect(m).toContain("Projected overspend");
  });

  it("notes when no budget is set", () => {
    const m = buildRecommendationsUserMessage({ ...baseCtx, budget: { ...baseCtx.budget!, hasBudget: false } });
    expect(m).toContain("No budget cap set");
  });

  it("includes previous-period section for trend context", () => {
    const prev = [{ platform: "meta", spendNok: 20_000, impressions: 0, clicks: 0, conversions: 0, conversionValueNok: 0, ctr: 2.8, cpc: 5.1, roas: 5.4, costPerConversionNok: null }];
    const m = buildRecommendationsUserMessage({ ...baseCtx, previousChannels: prev });
    expect(m).toContain("Previous period");
    expect(m).toContain("5,4");
  });
});

// ── Parsing er tolerant + validerende ──────────────────────────────────

describe("parseRecommendationsJson", () => {
  it("parses a clean recommendation set", () => {
    const json = JSON.stringify({
      recommendations: [
        { id: "pause-linkedin", type: "pause_underperformer", severity: "warning", title: "Vurder å pause LinkedIn", body: "ROAS 0,9 over en hel måned.", evidence: ["LinkedIn ROAS 0,9 vs Meta 4,8"], affectsChannels: ["linkedin"], suggestedAction: { kind: "manual" }, confidence: "high" },
      ],
      overallNote: "Meta og Google leverer; LinkedIn underyter.",
    });
    const parsed = parseRecommendationsJson(json, "2026-05");
    expect(parsed).not.toBeNull();
    expect(parsed!.recommendations).toHaveLength(1);
    expect(parsed!.recommendations[0].type).toBe("pause_underperformer");
    expect(parsed!.overallNote).toContain("underyter");
  });

  it("drops recommendations with invalid type or severity", () => {
    const json = JSON.stringify({
      recommendations: [
        { id: "ok", type: "scale_winner", severity: "info", title: "OK", body: "", evidence: [], suggestedAction: { kind: "manual" }, confidence: "medium" },
        { id: "bad", type: "make_pizza", severity: "info", title: "Nope", body: "", evidence: [], suggestedAction: { kind: "manual" }, confidence: "medium" },
        { id: "bad2", type: "scale_winner", severity: "panic", title: "Nope2", body: "", evidence: [], suggestedAction: { kind: "manual" }, confidence: "medium" },
      ],
    });
    const parsed = parseRecommendationsJson(json, "2026-05");
    expect(parsed!.recommendations).toHaveLength(1);
    expect(parsed!.recommendations[0].id).toBe("ok");
  });

  it("auto-generates id from title slug if missing", () => {
    const json = JSON.stringify({
      recommendations: [{ type: "investigate", severity: "info", title: "Sjekk Google-piksel — null konv.", body: "", evidence: [], suggestedAction: { kind: "manual" }, confidence: "low" }],
    });
    const parsed = parseRecommendationsJson(json, "2026-05");
    expect(parsed!.recommendations[0].id).toBe("sjekk-google-piksel-null-konv");
  });

  it("accepts an empty array (no recos = healthy)", () => {
    const parsed = parseRecommendationsJson(JSON.stringify({ recommendations: [], overallNote: "Alt rolig." }), "2026-05");
    expect(parsed!.recommendations).toEqual([]);
    expect(parsed!.overallNote).toBe("Alt rolig.");
  });

  it("returns null on unparseable input", () => {
    expect(parseRecommendationsJson("nope", "2026-05")).toBeNull();
    expect(parseRecommendationsJson(JSON.stringify({ wrong: "shape" }), "2026-05")).toBeNull();
  });
});

// ── Full generate-path med fake-client ──────────────────────────────────

function fakeClient(text: string, usage?: Record<string, number>): AdRecommendationsLlmClient {
  return {
    messages: {
      create: async () => ({
        content: [{ type: "text", text }],
        usage: usage ?? { input_tokens: 2_000, output_tokens: 600, cache_read_input_tokens: 1_800 },
      }),
    },
  };
}

describe("generateAdRecommendations", () => {
  it("returns a structured set with usage + cost when Claude responds", async () => {
    __setAdRecommendationsLlmClient(
      fakeClient(JSON.stringify({
        recommendations: [
          { id: "pause-linkedin", type: "pause_underperformer", severity: "warning", title: "Pause LinkedIn", body: "ROAS 0,9", evidence: ["LinkedIn ROAS 0,9"], affectsChannels: ["linkedin"], suggestedAction: { kind: "manual" }, confidence: "high" },
        ],
        overallNote: "Vurder budsjettflytting til Meta.",
      })),
    );
    const result = await generateAdRecommendations({ context: baseCtx });
    expect(result).not.toBeNull();
    expect(result!.period).toBe("2026-05");
    expect(result!.recommendations).toHaveLength(1);
    expect(result!.usage?.costNok).toBeGreaterThan(0);
    expect(result!.generatedWithModel).toBe("claude-sonnet-4-5");
  });

  it("returns null when Claude returns garbage", async () => {
    __setAdRecommendationsLlmClient(fakeClient("not json"));
    expect(await generateAdRecommendations({ context: baseCtx })).toBeNull();
  });

  it("returns null when the client throws", async () => {
    __setAdRecommendationsLlmClient({ messages: { create: async () => { throw new Error("rate limited"); } } });
    expect(await generateAdRecommendations({ context: baseCtx })).toBeNull();
  });

  it("accepts an empty channels list (no data yet) — still calls model and parses output", async () => {
    __setAdRecommendationsLlmClient(fakeClient(JSON.stringify({ recommendations: [], overallNote: "Ingen kampanjer i denne perioden." })));
    const result = await generateAdRecommendations({ context: { ...baseCtx, channels: [] } });
    expect(result!.recommendations).toEqual([]);
    expect(result!.overallNote).toContain("Ingen");
  });
});
