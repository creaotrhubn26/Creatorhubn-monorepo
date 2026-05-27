import { describe, it, expect, afterEach } from "vitest";
import {
  checkAdGenerationReadiness,
  buildAdSystemPrompt,
  buildAdUserMessage,
  parseAdCreativeJson,
  generateAdCreatives,
  PLATFORM_SPECS,
  __setAdCreativesLlmClient,
  type AdGenerationContext,
  type AdCreativesLlmClient,
} from "./role-room-ad-creatives.js";

afterEach(() => __setAdCreativesLlmClient(null));

const baseCtx: AdGenerationContext = {
  businessName: "MedInnova",
  productOrService: "PreVisit — digital forberedelse før legebesøk",
  industry: "helse",
  valueProp: "Tryggere og mer effektive legebesøk",
  differentiator: "Bygget med klinikere, ikke bare utviklere",
  toneVoice: "Faglig, varm, tillitsvekkende",
  toneDos: ["Bruk klart språk", "Vis empati"],
  toneDonts: ["Ikke lov helbredelse", "Ikke skap frykt"],
  targetAudience: "Pasienter 40-70 + helseforetak",
  keyMessage: "Møt forberedt — få mer ut av tiden med legen",
  language: "no",
};

// ── Readiness gate ─────────────────────────────────────────────────────

describe("checkAdGenerationReadiness", () => {
  it("passes when business name + at least one substance field present", () => {
    expect(checkAdGenerationReadiness(baseCtx).ready).toBe(true);
  });

  it("fails without a business name", () => {
    const r = checkAdGenerationReadiness({ ...baseCtx, businessName: "  " });
    expect(r.ready).toBe(false);
    expect(r.missingFields).toContain("businessName");
  });

  it("fails when there is nothing to say about the business", () => {
    const r = checkAdGenerationReadiness({
      businessName: "MedInnova",
      productOrService: null,
      valueProp: null,
      keyMessage: null,
      offer: null,
    });
    expect(r.ready).toBe(false);
    expect(r.missingFields.some((f) => f.includes("minst én"))).toBe(true);
  });

  it("accepts offer alone as substance", () => {
    const r = checkAdGenerationReadiness({ businessName: "X", offer: "20% i mai" });
    expect(r.ready).toBe(true);
  });
});

// ── System prompt is platform-shaped ───────────────────────────────────

describe("buildAdSystemPrompt", () => {
  it("tells Meta about the 40-char headline + 125-char primary text limits", () => {
    const p = buildAdSystemPrompt("meta");
    expect(p).toContain("≤ 40 characters");
    expect(p).toContain("125 characters");
    expect(p).toContain("LEARN_MORE");
  });

  it("asks Google for many RSA headlines + descriptions, no primary text", () => {
    const p = buildAdSystemPrompt("google");
    expect(p).toContain("5-12 headlines");
    expect(p).toContain("descriptions");
    expect(p).toContain("≤ 30 characters");
    expect(p).not.toContain("LEARN_MORE"); // google RSA has no CTA button list
  });

  it("always enforces the compliance guardrail", () => {
    for (const platform of Object.keys(PLATFORM_SPECS) as Array<keyof typeof PLATFORM_SPECS>) {
      const p = buildAdSystemPrompt(platform);
      expect(p).toContain("complianceChecklist");
      expect(p.toLowerCase()).toContain("medical");
    }
  });
});

// ── User message threads business + compliance context ─────────────────

describe("buildAdUserMessage", () => {
  it("includes brand voice, audience, and the goal guidance", () => {
    const m = buildAdUserMessage(baseCtx, "meta", "lead_generation");
    expect(m).toContain("MedInnova");
    expect(m).toContain("Faglig, varm");
    expect(m).toContain("Target audience");
    expect(m).toContain("lead_generation");
  });

  it("surfaces compliance constraints as absolute when provided", () => {
    const m = buildAdUserMessage(
      { ...baseCtx, complianceNotes: "Ingen påstand om diagnose eller helbredelse" },
      "meta",
      "lead_generation",
    );
    expect(m).toContain("COMPLIANCE CONSTRAINTS");
    expect(m).toContain("helbredelse");
  });

  it("requests Norwegian copy by default", () => {
    expect(buildAdUserMessage(baseCtx, "meta", "engagement")).toContain("Norwegian");
    expect(buildAdUserMessage({ ...baseCtx, language: "en" }, "meta", "engagement")).toContain("English");
  });
});

// ── Parsing is tolerant + validating ───────────────────────────────────

describe("parseAdCreativeJson", () => {
  it("parses a clean creative set", () => {
    const json = JSON.stringify({
      variants: [
        { headline: "Møt forberedt", primaryText: "PreVisit hjelper deg.", callToAction: "LEARN_MORE", imageBrief: "Rolig klinikk", imagePrompt: "calm clinic", rationale: "outcome-led" },
        { headline: "Få mer ut av timen", primaryText: "Forbered deg på minutter.", callToAction: "SIGN_UP", imageBrief: "Pasient + telefon", imagePrompt: "patient phone", rationale: "problem-led" },
      ],
      complianceChecklist: ["Verifiser at PreVisit ikke markedsføres som medisinsk utstyr uten godkjenning"],
    });
    const parsed = parseAdCreativeJson(json, "meta", "lead_generation");
    expect(parsed).not.toBeNull();
    expect(parsed!.variants).toHaveLength(2);
    expect(parsed!.platform).toBe("meta");
    expect(parsed!.complianceChecklist).toHaveLength(1);
  });

  it("strips ```json fences", () => {
    const json = "```json\n" + JSON.stringify({ variants: [{ headline: "Hei" }] }) + "\n```";
    expect(parseAdCreativeJson(json, "meta", "engagement")).not.toBeNull();
  });

  it("survives a trailing note after the JSON object", () => {
    const json = JSON.stringify({ variants: [{ headline: "Hei" }] }) + "\n\nHåper dette funker!";
    expect(parseAdCreativeJson(json, "meta", "engagement")).not.toBeNull();
  });

  it("drops variants without a headline but keeps valid ones", () => {
    const json = JSON.stringify({ variants: [{ primaryText: "no headline" }, { headline: "Gyldig" }] });
    const parsed = parseAdCreativeJson(json, "linkedin", "brand_awareness");
    expect(parsed!.variants).toHaveLength(1);
    expect(parsed!.variants[0].headline).toBe("Gyldig");
  });

  it("returns null when there are no usable variants", () => {
    expect(parseAdCreativeJson(JSON.stringify({ variants: [] }), "meta", "engagement")).toBeNull();
    expect(parseAdCreativeJson("not json at all", "meta", "engagement")).toBeNull();
  });
});

// ── Full generate path with an injected fake client ────────────────────

function fakeClient(text: string, usage?: Record<string, number>): AdCreativesLlmClient {
  return {
    messages: {
      create: async () => ({
        content: [{ type: "text", text }],
        usage: usage ?? { input_tokens: 1200, output_tokens: 400, cache_read_input_tokens: 1000 },
      }),
    },
  };
}

describe("generateAdCreatives", () => {
  it("returns a structured set with usage + cost when the model responds", async () => {
    const text = JSON.stringify({
      variants: [
        { headline: "Møt forberedt", primaryText: "PreVisit.", callToAction: "LEARN_MORE", imageBrief: "b", imagePrompt: "p", rationale: "r" },
      ],
      complianceChecklist: ["sjekk helsepåstand"],
    });
    __setAdCreativesLlmClient(fakeClient(text));
    const result = await generateAdCreatives({ context: baseCtx, platform: "meta", goal: "lead_generation" });
    expect(result).not.toBeNull();
    expect(result!.platform).toBe("meta");
    expect(result!.variants[0].headline).toBe("Møt forberedt");
    expect(result!.generatedWithModel).toBe("claude-sonnet-4-5");
    expect(result!.usage?.inputTokens).toBe(1200);
    expect(result!.usage?.costNok).toBeGreaterThan(0);
    expect(result!.complianceChecklist).toContain("sjekk helsepåstand");
  });

  it("carries the landing URL through to the result", async () => {
    __setAdCreativesLlmClient(fakeClient(JSON.stringify({ variants: [{ headline: "Hei" }] })));
    const result = await generateAdCreatives({
      context: { ...baseCtx, landingUrl: "https://previsit.no" },
      platform: "meta",
      goal: "lead_generation",
    });
    expect(result!.landingUrl).toBe("https://previsit.no");
  });

  it("returns null when the model returns unparseable output", async () => {
    __setAdCreativesLlmClient(fakeClient("the model rambled without JSON"));
    const result = await generateAdCreatives({ context: baseCtx, platform: "meta", goal: "engagement" });
    expect(result).toBeNull();
  });

  it("returns null when the client throws", async () => {
    __setAdCreativesLlmClient({ messages: { create: async () => { throw new Error("rate limited"); } } });
    const result = await generateAdCreatives({ context: baseCtx, platform: "google", goal: "ecommerce_conversion" });
    expect(result).toBeNull();
  });
});
