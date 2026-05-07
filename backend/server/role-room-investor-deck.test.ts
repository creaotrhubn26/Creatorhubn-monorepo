import { describe, it, expect, vi } from "vitest";
import {
  INVESTOR_PITCH_V1,
  getSectionDef,
  initialInvestorDeckSlides,
} from "./role-room-investor-deck-template.js";
import {
  generateInvestorSection,
  __setInvestorClaudeClient,
} from "./role-room-investor-deck-claude.js";

describe("INVESTOR_PITCH_V1 template", () => {
  it("contains all 8 user-spec'd sections in order", () => {
    const sections = INVESTOR_PITCH_V1.map((s) => s.section);
    expect(sections).toEqual([
      "cover",
      "problem",
      "solution",
      "market",
      "business_model",
      "competition",
      "traction",
      "team",
      "funding",
      "cta",
    ]);
  });

  it("positions are sequential 0..N", () => {
    INVESTOR_PITCH_V1.forEach((s, i) => {
      expect(s.position, `section ${s.section}`).toBe(i);
    });
  });

  it("each section has a Norwegian Claude prompt", () => {
    for (const s of INVESTOR_PITCH_V1) {
      expect(s.prompt.length).toBeGreaterThan(20);
      // Sanity: prompt instructs to return Norwegian content
      expect(s.prompt.toLowerCase()).toMatch(/norsk|markdown|punkt|forretnings|hype|setning/);
    }
  });

  it("required flag is true for the 8 user-spec'd sections + cover + cta", () => {
    expect(getSectionDef("problem")?.required).toBe(true);
    expect(getSectionDef("solution")?.required).toBe(true);
    expect(getSectionDef("market")?.required).toBe(true);
    expect(getSectionDef("business_model")?.required).toBe(true);
    expect(getSectionDef("competition")?.required).toBe(true);
    // Traction is optional (early-stage may not have any yet)
    expect(getSectionDef("traction")?.required).toBe(false);
    expect(getSectionDef("team")?.required).toBe(true);
    expect(getSectionDef("funding")?.required).toBe(true);
  });
});

describe("initialInvestorDeckSlides", () => {
  it("returns 10 seeded slides ready for INSERT", () => {
    const seeds = initialInvestorDeckSlides();
    expect(seeds).toHaveLength(10);
    expect(seeds[0].section).toBe("cover");
    expect(seeds[0].layout).toBe("title");
    expect(seeds[9].section).toBe("cta");
    expect(seeds[9].layout).toBe("cta");
    // All non-cover/cta default to 'standard' layout
    expect(seeds[1].layout).toBe("standard");
  });

  it("seeds the section title as default heading + empty body", () => {
    const seeds = initialInvestorDeckSlides();
    const problem = seeds.find((s) => s.section === "problem")!;
    expect(problem.content.heading).toBe("Problem");
    expect(problem.content.body).toBe("");
  });
});

describe("generateInvestorSection", () => {
  it("builds prompt with brand context + section-specific instructions", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const mockClient = {
      messages: {
        create: vi.fn(async (params: Record<string, unknown>) => {
          calls.push(params);
          return {
            content: [{ type: "text", text: "- Punkt 1\n- Punkt 2\n- Punkt 3" }],
            usage: { input_tokens: 250, output_tokens: 80 },
          };
        }),
      },
    };
    __setInvestorClaudeClient(mockClient as never);

    const result = await generateInvestorSection("market", {
      brandName: "Holy Crust AS",
      industry: "Restaurant / bakeri",
      description: "Surdeigsbakeri i Oslo",
      monthlyRevenueNok: 350_000,
      growthPhase: "growth",
      customNote: "Vurderer ekspansjon til Bergen + Trondheim",
    });

    expect(result.section).toBe("market");
    expect(result.body).toContain("Punkt 1");
    expect(result.inputTokens).toBe(250);
    expect(result.outputTokens).toBe(80);

    const call = calls[0];
    expect(call.model).toMatch(/claude/);
    expect(call.system).toMatch(/Norsk/);
    const userMsg = (call.messages as Array<{ role: string; content: string }>)[0];
    expect(userMsg.content).toContain("Holy Crust AS");
    expect(userMsg.content).toContain("Restaurant / bakeri");
    // toLocaleString("no-NO") may use NBSP/thin-space; just check digits present
    expect(userMsg.content).toMatch(/350[\s  ]?000/);
    expect(userMsg.content).toContain("Bergen");
    // Section-specific prompt is inlined
    expect(userMsg.content).toContain("TAM/SAM/SOM");

    __setInvestorClaudeClient(null);
  });

  it("rejects unknown section", async () => {
    __setInvestorClaudeClient({
      messages: {
        create: async () => {
          throw new Error("should not call");
        },
      },
    } as never);

    await expect(
      generateInvestorSection(
        "nonexistent" as never,
        { brandName: "Test" },
      ),
    ).rejects.toThrow(/Unknown investor section/);

    __setInvestorClaudeClient(null);
  });

  it("omits empty context fields gracefully", async () => {
    const calls: Array<Record<string, unknown>> = [];
    __setInvestorClaudeClient({
      messages: {
        create: vi.fn(async (params: Record<string, unknown>) => {
          calls.push(params);
          return {
            content: [{ type: "text", text: "ok" }],
            usage: { input_tokens: 100, output_tokens: 20 },
          };
        }),
      },
    } as never);

    await generateInvestorSection("problem", { brandName: "Minimal Co" });
    const userMsg = (calls[0].messages as Array<{ content: string }>)[0].content;
    expect(userMsg).toContain("Minimal Co");
    expect(userMsg).not.toContain("Bransje:");
    expect(userMsg).not.toContain("Vekst-fase:");

    __setInvestorClaudeClient(null);
  });
});
