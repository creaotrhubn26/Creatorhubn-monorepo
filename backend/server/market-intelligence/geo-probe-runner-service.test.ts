import { describe, expect, it } from "vitest";

import {
  aggregateToSignals,
  citesDomain,
  computeMissingPairs,
  extractBrandMentions,
  extractUrls,
  type ProbeResultForAggregation,
} from "./geo-probe-runner-service.js";
import { sanitizeGeneratedPrompts } from "./geo-prompt-set-service.js";
import { validateNormalizedSignal } from "../integrations/normalized-signal-schema.js";

describe("extractBrandMentions", () => {
  it("finds known brands case-insensitively, ranked by first occurrence", () => {
    const answer =
      "For leadgenerering i Norge anbefales ofte HubSpot, men Leadgrid er et " +
      "norsk alternativ. Pipedrive er også populært.";
    const mentions = extractBrandMentions(answer, ["Leadgrid", "HubSpot", "Pipedrive", "Salesforce"]);
    expect(mentions).toEqual([
      { name: "HubSpot", rank: 1 },
      { name: "Leadgrid", rank: 2 },
      { name: "Pipedrive", rank: 3 },
    ]);
  });

  it("does not match inside other words", () => {
    const mentions = extractBrandMentions("Superleadgridding er ikke en merkevare.", ["Leadgrid"]);
    expect(mentions).toEqual([]);
  });

  it("matches at string boundaries and before punctuation", () => {
    expect(extractBrandMentions("Leadgrid.", ["Leadgrid"])).toHaveLength(1);
    expect(extractBrandMentions("Prøv Leadgrid!", ["Leadgrid"])).toHaveLength(1);
  });
});

describe("extractUrls / citesDomain", () => {
  it("extracts and dedupes urls, stripping trailing punctuation", () => {
    const urls = extractUrls(
      "Se https://theroleroom.com/leadgrid. Også https://hubspot.com og https://theroleroom.com/leadgrid",
    );
    expect(urls).toEqual(["https://theroleroom.com/leadgrid", "https://hubspot.com"]);
  });

  it("citesDomain matches host and subdomains, not lookalikes", () => {
    expect(citesDomain(["https://www.theroleroom.com/x"], "theroleroom.com")).toBe(true);
    expect(citesDomain(["https://docs.theroleroom.com"], "theroleroom.com")).toBe(true);
    expect(citesDomain(["https://nottheroleroom.com"], "theroleroom.com")).toBe(false);
    expect(citesDomain(["https://hubspot.com"], null)).toBe(false);
  });
});

describe("aggregateToSignals", () => {
  const ctx = {
    organizationId: "8f14e45f-ceea-467f-a8db-000000000001",
    workspaceId: "user-1",
    runId: "run-1",
    targetBrand: "Leadgrid",
    competitorBrands: ["HubSpot"],
    region: "Norge",
    periodStart: "2026-07-06T05:00:00.000Z",
    periodEnd: "2026-07-06T06:00:00.000Z",
    collectedAt: "2026-07-06T06:00:00.000Z",
  };

  const results: ProbeResultForAggregation[] = [
    {
      promptTopic: "skaffe-leads",
      engine: "anthropic",
      mentionedBrands: [{ name: "HubSpot", rank: 1 }, { name: "Leadgrid", rank: 2 }],
      targetCited: true,
    },
    {
      promptTopic: "velge-crm",
      engine: "anthropic",
      mentionedBrands: [{ name: "HubSpot", rank: 1 }],
      targetCited: false,
    },
  ];

  it("produces contract-valid signals, all marked estimated/synthetic", () => {
    const signals = aggregateToSignals(results, ctx);
    expect(signals.length).toBeGreaterThan(0);
    for (const s of signals) {
      expect(validateNormalizedSignal(s).errors, s.id).toBeUndefined();
      expect(s.isEstimated).toBe(true);
      expect(s.metadata.synthetic).toBe(true);
    }
  });

  it("computes mention counts and share-of-voice per brand", () => {
    const signals = aggregateToSignals(results, ctx);
    const target = signals.find(
      (s) => s.subjectId === "Leadgrid" && s.metricType === "ai_mention",
    )!;
    const competitor = signals.find(
      (s) => s.subjectId === "HubSpot" && s.metricType === "ai_mention",
    )!;
    expect(target.metricValue).toBe(1);
    expect(competitor.metricValue).toBe(2);

    const targetShare = signals.find(
      (s) => s.subjectId === "Leadgrid" && s.metricType === "ai_mention_share",
    )!;
    // 1 av 3 totale omtaler
    expect(targetShare.metricValue).toBeCloseTo(33.33, 1);
    expect(targetShare.subjectType).toBe("own_property");
    expect(competitor.subjectType).toBe("competitor");
  });

  it("counts citations of the target domain", () => {
    const signals = aggregateToSignals(results, ctx);
    const cite = signals.find((s) => s.metricType === "ai_citation")!;
    expect(cite.metricValue).toBe(1);
  });

  it("uses deterministic ids per (engine, brand, metric, run)", () => {
    const a = aggregateToSignals(results, ctx).map((s) => s.id);
    const b = aggregateToSignals(results, ctx).map((s) => s.id);
    expect(a).toEqual(b);
  });

  it("returns nothing for empty results", () => {
    expect(aggregateToSignals([], ctx)).toEqual([]);
  });
});

describe("sanitizeGeneratedPrompts", () => {
  const args = { targetBrand: "Leadgrid", competitorBrands: ["HubSpot"], max: 10 };

  it("keeps valid prompts and normalizes topics", () => {
    const out = sanitizeGeneratedPrompts(
      {
        prompts: [
          { text: "Hvordan skaffer jeg flere B2B-leads i Norge?", topic: "Skaffe Leads!", intent: "howto" },
        ],
      },
      args,
    );
    expect(out).toHaveLength(1);
    expect(out[0].topic).toBe("skaffe-leads");
    expect(out[0].intent).toBe("howto");
  });

  it("drops prompts that mention target or competitor brands", () => {
    const out = sanitizeGeneratedPrompts(
      {
        prompts: [
          { text: "Er Leadgrid bra for leadgenerering?", topic: "verktoy", intent: "buying" },
          { text: "Bør jeg velge HubSpot?", topic: "verktoy", intent: "comparison" },
          { text: "Beste system for oppfølging av befaringer?", topic: "verktoy", intent: "buying" },
        ],
      },
      args,
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toContain("befaringer");
  });

  it("dedupes, enforces max and defaults invalid intents to buying", () => {
    const out = sanitizeGeneratedPrompts(
      {
        prompts: [
          { text: "Hvordan få flere kunder som håndverker?", topic: "kunder", intent: "weird" },
          { text: "hvordan få flere kunder som håndverker?", topic: "kunder", intent: "howto" },
        ],
      },
      args,
    );
    expect(out).toHaveLength(1);
    expect(out[0].intent).toBe("buying");
  });

  it("returns [] on garbage input", () => {
    expect(sanitizeGeneratedPrompts(null, args)).toEqual([]);
    expect(sanitizeGeneratedPrompts({ prompts: "nope" }, args)).toEqual([]);
  });
});

describe("computeMissingPairs (resumerbare kjøringer)", () => {
  it("returns all pairs when nothing exists", () => {
    const missing = computeMissingPairs(["p1", "p2"], ["anthropic", "openai"], []);
    expect(missing).toHaveLength(4);
  });

  it("skips pairs that already have results (resume after restart)", () => {
    const missing = computeMissingPairs(
      ["p1", "p2"],
      ["anthropic"],
      [{ prompt_id: "p1", engine: "anthropic" }],
    );
    expect(missing).toEqual([{ promptId: "p2", engine: "anthropic" }]);
  });

  it("returns [] when the run is complete", () => {
    const missing = computeMissingPairs(
      ["p1"],
      ["anthropic"],
      [{ prompt_id: "p1", engine: "anthropic" }],
    );
    expect(missing).toEqual([]);
  });
});
