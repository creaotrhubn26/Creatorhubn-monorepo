import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateWeekPlan,
  validateConcepts,
  DAY_FORMAT_SCHEDULE,
  __setStrategistAnthropic,
  type CarouselConcept,
} from "./role-room-content-strategist.js";
import type { BrandProfile } from "./role-room-website-analyzer.js";

const HOLY_CRUST: BrandProfile = {
  url: "https://holycrust.no",
  fetchedAt: new Date().toISOString(),
  businessName: "Holy Crust",
  tagline: "Surdeigsbakeri i Oslo",
  description: "Surdeigsbakeri på Grünerløkka. Daglig fersk levering hjemme i Oslo.",
  toneOfVoice: "warm",
  usps: [
    "Naturlig surdeigskultur",
    "Lokalt mel fra Holli Mølle",
    "Hjemlevering i Oslo",
  ],
  primaryCTA: "Bestill online",
  colors: {
    primary: "#8b3a1f",
    secondary: "#d4a574",
    accent: "#f4e8d0",
    background: "#ffffff",
    text: "#0f172a",
  },
  fonts: { heading: "Playfair Display", body: "Inter" },
  logoUrl: null,
  faviconUrl: null,
  productCategories: ["Meny", "Lokasjoner"],
  hasShop: false,
  hasBlog: true,
  socialLinks: [],
  industry: "restaurant",
  targetAudience: "Oslo-bevisste matelskere",
};

function makeConcept(
  dayOfWeek: number,
  format: string,
  hook = `Hook ${dayOfWeek}`,
): CarouselConcept {
  return {
    dayOfWeek: dayOfWeek as CarouselConcept["dayOfWeek"],
    format: format as CarouselConcept["format"],
    primaryPlatform: "instagram",
    hook,
    narrative: "Setup → escalation → reveal.",
    slides: [
      { role: "cover", text: "Slide 1", imagePrompt: "hero shot" },
      { role: "context", text: "Slide 2", imagePrompt: "context" },
      { role: "reveal", text: "Slide 3", imagePrompt: "reveal" },
      { role: "cta", text: "Slide 4", imagePrompt: "tablet mockup" },
    ],
    caption: {
      instagram: "IG caption #surdeig",
      facebook: "FB story",
      linkedin: "LI formal".repeat(200), // ~2000 chars
      pinterest: "Pinterest title — keyword-dense",
      youtube: "YT question?",
    },
    optimalPostTime: "10:00",
  };
}

const VALID_WEEK = DAY_FORMAT_SCHEDULE.map((d) => makeConcept(d.dayOfWeek, d.format));

beforeEach(() => {
  __setStrategistAnthropic(null);
});

describe("DAY_FORMAT_SCHEDULE", () => {
  it("covers all 7 days, monday=humor, sunday=story_insight", () => {
    expect(DAY_FORMAT_SCHEDULE).toHaveLength(7);
    expect(DAY_FORMAT_SCHEDULE[0]).toMatchObject({ dayOfWeek: 0, format: "humor" });
    expect(DAY_FORMAT_SCHEDULE[6]).toMatchObject({ dayOfWeek: 6, format: "story_insight" });
  });

  it("each day has unique format", () => {
    const formats = DAY_FORMAT_SCHEDULE.map((d) => d.format);
    expect(new Set(formats).size).toBe(7);
  });
});

describe("validateConcepts", () => {
  it("accepts a valid 7-day plan", () => {
    const result = validateConcepts(VALID_WEEK);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.concepts).toHaveLength(7);
  });

  it("rejects when not array", () => {
    const result = validateConcepts({ foo: "bar" });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/not an array/);
  });

  it("rejects missing days", () => {
    const five = VALID_WEEK.slice(0, 5);
    const result = validateConcepts(five);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /Expected 7 concepts/.test(e))).toBe(true);
    expect(result.errors.filter((e) => /Missing concept for day/.test(e))).toHaveLength(2);
  });

  it("rejects mismatched format-day combos", () => {
    const wrong = VALID_WEEK.map((c, i) =>
      i === 0 ? { ...c, format: "promo" } : c,
    );
    const result = validateConcepts(wrong);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /requires format "humor"/.test(e))).toBe(true);
  });

  it("rejects duplicate hooks", () => {
    const dup = VALID_WEEK.map((c, i) =>
      i < 2 ? { ...c, hook: "Identical hook" } : c,
    );
    const result = validateConcepts(dup);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /Duplicate hooks/.test(e))).toBe(true);
  });

  it("rejects oversized Instagram caption (>2200 chars)", () => {
    const oversized = VALID_WEEK.map((c, i) =>
      i === 0
        ? {
            ...c,
            caption: { ...c.caption, instagram: "x".repeat(2201) },
          }
        : c,
    );
    const result = validateConcepts(oversized);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /Instagram caption .* > 2200/.test(e))).toBe(true);
  });

  it("rejects slides outside 4-6 range", () => {
    const bad = VALID_WEEK.map((c, i) =>
      i === 0 ? { ...c, slides: c.slides.slice(0, 2) } : c,
    );
    const result = validateConcepts(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /slides must be 4-6/.test(e))).toBe(true);
  });

  it("rejects invalid slide role", () => {
    const bad = VALID_WEEK.map((c, i) =>
      i === 0
        ? {
            ...c,
            slides: c.slides.map((s) =>
              s.role === "cover" ? { ...s, role: "header" } : s,
            ),
          }
        : c,
    );
    const result = validateConcepts(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /invalid role\/text\/imagePrompt/.test(e))).toBe(true);
  });

  it("rejects invalid optimalPostTime format", () => {
    const bad = VALID_WEEK.map((c, i) =>
      i === 0 ? { ...c, optimalPostTime: "10am" } : c,
    );
    const result = validateConcepts(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /optimalPostTime must be HH:MM/.test(e))).toBe(true);
  });
});

describe("generateWeekPlan", () => {
  it("returns sorted plan on first attempt success", async () => {
    const create = vi.fn(async () => ({
      content: [{ type: "text", text: JSON.stringify(VALID_WEEK) }],
      usage: { input_tokens: 1500, output_tokens: 4000 },
    }));
    __setStrategistAnthropic({ messages: { create } } as never);

    const plan = await generateWeekPlan(HOLY_CRUST, "2026-05-11");

    expect(plan.weekStarting).toBe("2026-05-11");
    expect(plan.concepts).toHaveLength(7);
    expect(plan.concepts[0].dayOfWeek).toBe(0);
    expect(plan.concepts[6].dayOfWeek).toBe(6);
    expect(create).toHaveBeenCalledTimes(1);
    expect(plan.generationNotes[0]).toMatch(/validated/);
  });

  it("retries on validation failure with retry-notes", async () => {
    const broken = VALID_WEEK.slice(0, 6); // missing day 6
    const responses = [
      JSON.stringify(broken),
      JSON.stringify(VALID_WEEK),
    ];
    let i = 0;
    const create = vi.fn(async () => ({
      content: [{ type: "text", text: responses[i++] }],
      usage: { input_tokens: 1500, output_tokens: 4000 },
    }));
    __setStrategistAnthropic({ messages: { create } } as never);

    const plan = await generateWeekPlan(HOLY_CRUST, "2026-05-11");

    expect(plan.concepts).toHaveLength(7);
    expect(create).toHaveBeenCalledTimes(2);
    // Second prompt should have retry notes
    const secondCall = create.mock.calls[1][0] as { messages: Array<{ content: string }> };
    expect(secondCall.messages[0].content).toMatch(/PREVIOUS ATTEMPT FAILED/);
    expect(secondCall.messages[0].content).toMatch(/Missing concept for day/);
  });

  it("retries on JSON parse failure", async () => {
    const responses = ["not json at all{{{", JSON.stringify(VALID_WEEK)];
    let i = 0;
    const create = vi.fn(async () => ({
      content: [{ type: "text", text: responses[i++] }],
      usage: { input_tokens: 100, output_tokens: 100 },
    }));
    __setStrategistAnthropic({ messages: { create } } as never);

    const plan = await generateWeekPlan(HOLY_CRUST, "2026-05-11");
    expect(plan.concepts).toHaveLength(7);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("strips markdown code-fences from Claude output", async () => {
    const responses = ["```json\n" + JSON.stringify(VALID_WEEK) + "\n```"];
    let i = 0;
    const create = vi.fn(async () => ({
      content: [{ type: "text", text: responses[i++] }],
      usage: { input_tokens: 100, output_tokens: 100 },
    }));
    __setStrategistAnthropic({ messages: { create } } as never);

    const plan = await generateWeekPlan(HOLY_CRUST, "2026-05-11");
    expect(plan.concepts).toHaveLength(7);
  });

  it("throws after maxAttempts exhausted", async () => {
    const create = vi.fn(async () => ({
      content: [{ type: "text", text: JSON.stringify([{ broken: true }]) }],
      usage: { input_tokens: 100, output_tokens: 100 },
    }));
    __setStrategistAnthropic({ messages: { create } } as never);

    await expect(
      generateWeekPlan(HOLY_CRUST, "2026-05-11", { maxAttempts: 2 }),
    ).rejects.toThrow(/failed after 2 attempts/);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("includes brand context in the prompt", async () => {
    const create = vi.fn(async () => ({
      content: [{ type: "text", text: JSON.stringify(VALID_WEEK) }],
      usage: { input_tokens: 100, output_tokens: 100 },
    }));
    __setStrategistAnthropic({ messages: { create } } as never);

    await generateWeekPlan(HOLY_CRUST, "2026-05-11");
    const call = create.mock.calls[0][0] as { messages: Array<{ content: string }> };
    const prompt = call.messages[0].content;
    expect(prompt).toContain("Holy Crust");
    expect(prompt).toContain("Surdeigsbakeri");
    expect(prompt).toContain("Naturlig surdeigskultur");
    expect(prompt).toContain("restaurant");
    expect(prompt).toContain("Oslo-bevisste matelskere");
    expect(prompt).toContain("WEEK STARTING");
  });
});
