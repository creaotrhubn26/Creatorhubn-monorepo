import { describe, it, expect, vi } from "vitest";
import {
  CAROUSEL_LAYOUTS,
  pickLayout,
  type LayoutId,
} from "./role-room-carousel-layouts.js";
import {
  resolveImage,
  extractTags,
  type ResolverContext,
} from "./role-room-carousel-image-resolver.js";
import { generateCarouselDraft } from "./role-room-carousel-generator.js";
import type { BrandProfile } from "./role-room-website-analyzer.js";
import type { WeekPlan } from "./role-room-content-strategist.js";

// ──────────────────────────────────────────────────────────────
// Layouts
// ──────────────────────────────────────────────────────────────

describe("CAROUSEL_LAYOUTS", () => {
  it("ships exactly 8 layouts", () => {
    expect(Object.keys(CAROUSEL_LAYOUTS)).toHaveLength(8);
  });

  it("every layout declares allowed roles + at least one text slot", () => {
    for (const def of Object.values(CAROUSEL_LAYOUTS)) {
      expect(def.allowedRoles.length).toBeGreaterThan(0);
      expect(def.textSlots.length).toBeGreaterThan(0);
    }
  });

  it("color-only / big-number / list-item are flagged worksWithoutImage", () => {
    expect(CAROUSEL_LAYOUTS["centered-quote"].worksWithoutImage).toBe(true);
    expect(CAROUSEL_LAYOUTS["big-number"].worksWithoutImage).toBe(true);
    expect(CAROUSEL_LAYOUTS["list-item"].worksWithoutImage).toBe(true);
    expect(CAROUSEL_LAYOUTS["cover-fullbleed"].worksWithoutImage).toBe(false);
  });
});

describe("pickLayout", () => {
  it("first slide always goes cover-fullbleed", () => {
    expect(
      pickLayout("context", { format: "humor", slideIndex: 0, totalSlides: 6, hasImage: true }),
    ).toBe("cover-fullbleed");
  });

  it("cover role always goes cover-fullbleed", () => {
    expect(
      pickLayout("cover", { format: "promo", slideIndex: 2, totalSlides: 6, hasImage: true }),
    ).toBe("cover-fullbleed");
  });

  it("last slide always goes tablet-mockup (closing reveal)", () => {
    expect(
      pickLayout("context", { format: "humor", slideIndex: 5, totalSlides: 6, hasImage: true }),
    ).toBe("tablet-mockup");
  });

  it("quote role goes centered-quote", () => {
    expect(
      pickLayout("quote", { format: "customer_story", slideIndex: 2, totalSlides: 5, hasImage: true }),
    ).toBe("centered-quote");
  });

  it("educational + point goes list-item", () => {
    expect(
      pickLayout("point", {
        format: "educational",
        slideIndex: 2,
        totalSlides: 6,
        hasImage: true,
      }),
    ).toBe("list-item");
  });

  it("falls back to big-number when no image source available + middle slide", () => {
    expect(
      pickLayout("point", {
        format: "humor",
        slideIndex: 2,
        totalSlides: 6,
        hasImage: false,
      }),
    ).toBe("big-number");
  });

  it("BTS / customer_story → split-50-50 for context slides", () => {
    expect(
      pickLayout("context", {
        format: "bts",
        slideIndex: 1,
        totalSlides: 5,
        hasImage: true,
      }),
    ).toBe("split-50-50");
    expect(
      pickLayout("context", {
        format: "customer_story",
        slideIndex: 1,
        totalSlides: 5,
        hasImage: true,
      }),
    ).toBe("split-50-50");
  });

  it("default middle slide goes fullbleed-photo-text", () => {
    expect(
      pickLayout("context", {
        format: "humor",
        slideIndex: 1,
        totalSlides: 6,
        hasImage: true,
      }),
    ).toBe("fullbleed-photo-text");
  });
});

// ──────────────────────────────────────────────────────────────
// Image resolver
// ──────────────────────────────────────────────────────────────

describe("extractTags", () => {
  it("strips stop-words + punctuation", () => {
    const tags = extractTags("A photo of fresh bread on the table");
    expect(tags).toContain("photo");
    expect(tags).toContain("fresh");
    expect(tags).toContain("bread");
    expect(tags).not.toContain("the");
    expect(tags).not.toContain("of");
    expect(tags).not.toContain("a");
  });

  it("handles Norwegian stop-words", () => {
    const tags = extractTags("En bunke surdeigsbrød på et tre-bord i Oslo");
    expect(tags).toContain("bunke");
    expect(tags).toContain("surdeigsbrød");
    expect(tags).toContain("oslo");
    expect(tags).not.toContain("en");
    expect(tags).not.toContain("på");
  });

  it("clamps to 8 tags max", () => {
    const tags = extractTags(
      "fresh bread sourdough oslo morning bakery oven flour water salt yeast",
    );
    expect(tags.length).toBeLessThanOrEqual(8);
  });
});

describe("resolveImage", () => {
  function ctx(overrides: Partial<ResolverContext> = {}): ResolverContext {
    return {
      brandAssetLookup: vi.fn(async () => null),
      stockSearch: vi.fn(async () => null),
      fallbackColor: "#0a0617",
      ...overrides,
    };
  }

  it("prefers brand-asset over stock when both succeed", async () => {
    const brandLookup = vi.fn(async () => ({
      strategy: "brand-asset" as const,
      assetId: "asset-1",
      url: "https://r2/asset-1.jpg",
      alt: "Brand logo",
    }));
    const stockSearch = vi.fn(async () => ({
      strategy: "stock" as const,
      provider: "unsplash" as const,
      photoId: "stock-1",
      url: "https://unsplash/foo.jpg",
      thumbnailUrl: "https://unsplash/foo-thumb.jpg",
      attribution: "Photographer",
      attributionUrl: "https://unsplash.com/@photographer",
    }));
    const out = await resolveImage(
      { userId: "u1", imagePrompt: "fresh bread", worksWithoutImage: false },
      ctx({ brandAssetLookup: brandLookup, stockSearch }),
    );
    expect(out.strategy).toBe("brand-asset");
    expect(stockSearch).not.toHaveBeenCalled();
  });

  it("falls back to stock when brand-asset returns null", async () => {
    const stockSearch = vi.fn(async () => ({
      strategy: "stock" as const,
      provider: "unsplash" as const,
      photoId: "stock-1",
      url: "https://unsplash/foo.jpg",
      thumbnailUrl: "https://unsplash/foo-thumb.jpg",
      attribution: "Photographer",
      attributionUrl: "https://unsplash.com/@photographer",
    }));
    const out = await resolveImage(
      { userId: "u1", imagePrompt: "fresh bread", worksWithoutImage: false },
      ctx({ stockSearch }),
    );
    expect(out.strategy).toBe("stock");
  });

  it("falls back to color-only when nothing else returns", async () => {
    const out = await resolveImage(
      { userId: "u1", imagePrompt: "abstract concept", worksWithoutImage: true },
      ctx(),
    );
    expect(out.strategy).toBe("color-only");
    expect(out).toMatchObject({ color: "#0a0617", textFirst: true });
  });

  it("brandFirstOnly skips stock fallback", async () => {
    const stockSearch = vi.fn(async () => ({
      strategy: "stock" as const,
      provider: "unsplash" as const,
      photoId: "stock-1",
      url: "x",
      thumbnailUrl: "x",
      attribution: "x",
      attributionUrl: "x",
    }));
    const out = await resolveImage(
      { userId: "u1", imagePrompt: "anything", worksWithoutImage: true },
      ctx({ brandFirstOnly: true, stockSearch }),
    );
    expect(out.strategy).toBe("color-only");
    expect(stockSearch).not.toHaveBeenCalled();
  });

  it("survives a brand-asset lookup that throws", async () => {
    const out = await resolveImage(
      { userId: "u1", imagePrompt: "anything", worksWithoutImage: true },
      ctx({
        brandAssetLookup: async () => {
          throw new Error("DB exploded");
        },
      }),
    );
    expect(out.strategy).toBe("color-only");
  });
});

// ──────────────────────────────────────────────────────────────
// Generator (full DB transaction)
// ──────────────────────────────────────────────────────────────

const BRAND: BrandProfile = {
  url: "https://holycrust.no",
  fetchedAt: new Date().toISOString(),
  businessName: "Holy Crust",
  tagline: "Surdeigsbakeri i Oslo",
  description: "Beskrivelse",
  toneOfVoice: "warm",
  usps: ["A", "B", "C"],
  primaryCTA: "Bestill",
  colors: { primary: "#8b3a1f", secondary: "#d4a574", accent: "#f4e8d0", background: "#fff", text: "#000" },
  fonts: { heading: "Playfair", body: "Inter" },
  logoUrl: "https://holycrust.no/logo.png",
  faviconUrl: null,
  productCategories: [],
  hasShop: false,
  hasBlog: false,
  socialLinks: [],
  industry: "restaurant",
  targetAudience: "",
};

function makeWeekPlan(): WeekPlan {
  const formats: Array<WeekPlan["concepts"][number]["format"]> = [
    "humor", "educational", "bts", "customer_story", "promo", "seasonal", "story_insight",
  ];
  return {
    weekStarting: "2026-05-11",
    concepts: formats.map((format, dayOfWeek) => ({
      dayOfWeek: dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      format,
      primaryPlatform: "instagram",
      hook: `Hook for ${format}`,
      narrative: "Setup → reveal.",
      slides: [
        { role: "cover", text: "Cover text", imagePrompt: "hero" },
        { role: "context", text: "Context text", imagePrompt: "context shot" },
        { role: "reveal", text: "Reveal text", imagePrompt: "reveal shot" },
        { role: "cta", text: "CTA text", imagePrompt: "tablet" },
      ],
      caption: {
        instagram: "ig",
        facebook: "fb",
        linkedin: "li",
        pinterest: "pin",
        youtube: "yt",
      },
      optimalPostTime: "10:00",
    })),
    generationNotes: [],
  };
}

function makeMockPool() {
  let nextId = 1;
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      const trimmedSql = sql.trim().toUpperCase();
      if (trimmedSql.startsWith("BEGIN") || trimmedSql.startsWith("COMMIT") || trimmedSql.startsWith("ROLLBACK")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO carousel_drafts")) {
        return { rows: [{ id: `draft-${nextId++}` }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO carousel_posts")) {
        return { rows: [{ id: `post-${nextId++}` }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO carousel_slides")) {
        return { rows: [{ id: `slide-${nextId++}` }], rowCount: 1 };
      }
      if (sql.includes("UPDATE carousel_drafts")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };
  const pool = {
    connect: vi.fn(async () => client),
  };
  return { pool, client, calls };
}

describe("generateCarouselDraft", () => {
  it("persists draft + 7 posts + slides in a single transaction", async () => {
    const { pool, calls } = makeMockPool();
    const result = await generateCarouselDraft(
      pool as never,
      {
        userId: "u1",
        websiteAnalysisId: "wa-1",
        weekPlan: makeWeekPlan(),
        brand: BRAND,
      },
      {
        brandAssetLookup: async () => null,
        stockSearch: async () => null,
        fallbackColor: "#0a0617",
      },
    );

    expect(result.status).toBe("ready");
    expect(result.totalPosts).toBe(7);
    expect(result.posts).toHaveLength(7);

    const sqlList = calls.map((c) => c.sql.trim().split(/\s+/, 3).join(" "));
    expect(sqlList[0]).toBe("BEGIN");
    expect(sqlList[sqlList.length - 1]).toBe("COMMIT");

    const insertedSlides = calls.filter((c) =>
      c.sql.includes("INSERT INTO carousel_slides"),
    );
    expect(insertedSlides).toHaveLength(28); // 7 posts × 4 slides each
  });

  it("falls back to text-only layout when image resolves to color-only", async () => {
    const { pool } = makeMockPool();
    const result = await generateCarouselDraft(
      pool as never,
      {
        userId: "u1",
        websiteAnalysisId: "wa-1",
        weekPlan: makeWeekPlan(),
        brand: BRAND,
      },
      {
        brandAssetLookup: async () => null,
        stockSearch: async () => null,
        fallbackColor: "#0a0617",
      },
    );

    // Middle slide (point/context, not first/last/quote) with no image
    // should fall back to big-number layout (worksWithoutImage = true).
    const middleSlides = result.posts.flatMap((p) =>
      p.slides.filter(
        (s, i) =>
          i !== 0 &&
          i !== p.slides.length - 1 &&
          s.imageRef.strategy === "color-only" &&
          s.role !== "quote" &&
          s.role !== "cta",
      ),
    );
    expect(middleSlides.length).toBeGreaterThan(0);
    for (const slide of middleSlides) {
      expect(slide.layout).toBe("big-number");
    }
  });

  it("rolls back when an INSERT fails midway", async () => {
    const { pool, client } = makeMockPool();
    let sliceCount = 0;
    (client.query as ReturnType<typeof vi.fn>).mockImplementation(
      async (sql: string, _params?: unknown[]) => {
        if (sql.trim().startsWith("BEGIN") || sql.trim().startsWith("ROLLBACK")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("INSERT INTO carousel_drafts")) {
          return { rows: [{ id: "draft-1" }], rowCount: 1 };
        }
        if (sql.includes("INSERT INTO carousel_posts")) {
          return { rows: [{ id: "post-1" }], rowCount: 1 };
        }
        if (sql.includes("INSERT INTO carousel_slides")) {
          sliceCount++;
          if (sliceCount === 3) throw new Error("DB constraint failed");
          return { rows: [{ id: `slide-${sliceCount}` }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    );
    await expect(
      generateCarouselDraft(
        pool as never,
        {
          userId: "u1",
          websiteAnalysisId: "wa-1",
          weekPlan: makeWeekPlan(),
          brand: BRAND,
        },
        {
          brandAssetLookup: async () => null,
          stockSearch: async () => null,
          fallbackColor: "#0a0617",
        },
      ),
    ).rejects.toThrow(/DB constraint/);

    const callArgs = (client.query as ReturnType<typeof vi.fn>).mock.calls;
    const sqls = callArgs.map((args) => (args[0] as string).trim().toUpperCase());
    expect(sqls).toContain("ROLLBACK");
    expect(sqls).not.toContain("COMMIT");
  });
});
