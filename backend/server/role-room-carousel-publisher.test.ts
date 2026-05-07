import { describe, it, expect, vi } from "vitest";
import {
  publishCarouselPost,
  validateForPublish,
  ValidationFailedError,
  type PublishablePost,
  type PublishableSlide,
} from "./role-room-carousel-publisher.js";

function makePost(overrides: Partial<PublishablePost> = {}): PublishablePost {
  return {
    id: "post-1",
    draftId: "draft-1",
    dayOfWeek: 0,
    format: "humor",
    primaryPlatform: "instagram",
    hook: "Production Life: We've all been there",
    narrative: "Setup → reveal.",
    caption: {
      instagram: "Caption for IG",
      facebook: "Caption for FB",
      linkedin: "Caption for LI",
      pinterest: "Pin title",
      youtube: "Question for YT?",
    },
    scheduledAt: null,
    ...overrides,
  };
}

function makeSlides(count = 4): PublishableSlide[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: `slide-${i + 1}`,
    postId: "post-1",
    slideIndex: i,
    imageRef: { strategy: "stock", url: `https://x/${i}.jpg` },
    textBlocks: [{ position: "top-left", style: "headline", content: `Slide ${i + 1}` }],
    brandOverlays: { brandName: "Holy Crust", primaryColor: "#8b3a1f", accentColor: "#f4e8d0" },
  }));
}

describe("validateForPublish", () => {
  it("accepts a valid IG carousel", () => {
    const out = validateForPublish(makePost(), makeSlides(4));
    expect(out.ok).toBe(true);
    expect(out.errors).toEqual([]);
  });

  it("rejects empty caption", () => {
    const post = makePost({ caption: { ...makePost().caption, instagram: "" } });
    const out = validateForPublish(post, makeSlides(4));
    expect(out.ok).toBe(false);
    expect(out.errors[0]).toMatch(/Caption .* empty/);
  });

  it("rejects oversized IG caption", () => {
    const post = makePost({
      caption: { ...makePost().caption, instagram: "a".repeat(2201) },
    });
    const out = validateForPublish(post, makeSlides(4));
    expect(out.ok).toBe(false);
    expect(out.errors[0]).toMatch(/over limit/);
  });

  it("warns when caption is within 5% of limit", () => {
    const post = makePost({
      caption: { ...makePost().caption, instagram: "a".repeat(2150) },
    });
    const out = validateForPublish(post, makeSlides(4));
    expect(out.ok).toBe(true);
    expect(out.warnings[0]).toMatch(/within 5%/);
  });

  it("rejects too many slides for LinkedIn (max 9)", () => {
    const out = validateForPublish(
      makePost({ primaryPlatform: "linkedin" }),
      makeSlides(10),
    );
    expect(out.ok).toBe(false);
    expect(out.errors.some((e) => /caps at 9/.test(e))).toBe(true);
  });

  it("rejects too many slides for Pinterest (max 1)", () => {
    const out = validateForPublish(
      makePost({ primaryPlatform: "pinterest" }),
      makeSlides(2),
    );
    expect(out.ok).toBe(false);
    expect(out.errors.some((e) => /caps at 1/.test(e))).toBe(true);
  });

  it("rejects color-only on Pinterest (image required)", () => {
    const slides = makeSlides(1);
    slides[0].imageRef = { strategy: "color-only", color: "#000" };
    const out = validateForPublish(makePost({ primaryPlatform: "pinterest" }), slides);
    expect(out.ok).toBe(false);
    expect(out.errors[0]).toMatch(/Pinterest pin requires an image/);
  });

  it("warns (not errors) when other platforms have color-only fallbacks", () => {
    const slides = makeSlides(4);
    slides[1].imageRef = { strategy: "color-only", color: "#000" };
    const out = validateForPublish(makePost(), slides);
    expect(out.ok).toBe(true);
    expect(out.warnings.some((w) => /color-only fallback/.test(w))).toBe(true);
  });
});

function makeMockPool() {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith("BEGIN") || trimmed.startsWith("COMMIT") || trimmed.startsWith("ROLLBACK")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("SELECT id FROM role_room_feed_plans")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO role_room_feed_plans")) {
        return { rows: [{ id: "feed-plan-1" }], rowCount: 1 };
      }
      if (sql.includes("UPDATE carousel_posts")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client) };
  return { pool, client, calls };
}

describe("publishCarouselPost", () => {
  it("creates a new feed_plan + appends post in a transaction", async () => {
    const { pool, calls } = makeMockPool();
    const result = await publishCarouselPost(
      pool as never,
      "user-1",
      makePost(),
      makeSlides(4),
      { projectId: "proj-1" },
    );
    expect(result.feedPlanId).toBe("feed-plan-1");
    expect(result.platform).toBe("instagram");
    expect(result.feedPlanPostId).toBeTruthy();

    const sqls = calls.map((c) => c.sql.trim().split(/\s+/, 3).join(" "));
    expect(sqls[0]).toBe("BEGIN");
    expect(sqls[sqls.length - 1]).toBe("COMMIT");
    // INSERT into role_room_feed_plans was issued
    expect(calls.some((c) => c.sql.includes("INSERT INTO role_room_feed_plans"))).toBe(true);
    // carousel_posts was patched
    expect(calls.some((c) => c.sql.includes("UPDATE carousel_posts"))).toBe(true);
  });

  it("appends to existing feed_plan when one already exists", async () => {
    const { pool, calls, client } = makeMockPool();
    (client.query as ReturnType<typeof vi.fn>).mockImplementation(
      async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params });
        if (sql.includes("SELECT id FROM role_room_feed_plans")) {
          return { rows: [{ id: "existing-fp" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      },
    );
    const result = await publishCarouselPost(
      pool as never,
      "user-1",
      makePost(),
      makeSlides(4),
      { projectId: "proj-1" },
    );
    expect(result.feedPlanId).toBe("existing-fp");
    // Append-update issued
    expect(calls.some((c) => c.sql.includes("UPDATE role_room_feed_plans"))).toBe(true);
    // No new INSERT
    expect(calls.some((c) => c.sql.includes("INSERT INTO role_room_feed_plans"))).toBe(false);
  });

  it("skips carousel_posts UPDATE when markScheduled=false", async () => {
    const { pool, calls } = makeMockPool();
    await publishCarouselPost(
      pool as never,
      "user-1",
      makePost(),
      makeSlides(4),
      { projectId: "proj-1", markScheduled: false },
    );
    expect(calls.some((c) => c.sql.includes("UPDATE carousel_posts"))).toBe(false);
  });

  it("throws ValidationFailedError when caption empty", async () => {
    const { pool } = makeMockPool();
    const post = makePost({ caption: { ...makePost().caption, instagram: "" } });
    await expect(
      publishCarouselPost(pool as never, "user-1", post, makeSlides(4), { projectId: "proj-1" }),
    ).rejects.toBeInstanceOf(ValidationFailedError);
  });

  it("rolls back when feed_plan upsert throws", async () => {
    const { pool, client, calls } = makeMockPool();
    (client.query as ReturnType<typeof vi.fn>).mockImplementation(
      async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params });
        if (sql.trim().toUpperCase().startsWith("BEGIN") || sql.trim().toUpperCase().startsWith("ROLLBACK")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("SELECT id FROM role_room_feed_plans")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("INSERT INTO role_room_feed_plans")) {
          throw new Error("DB exploded");
        }
        return { rows: [], rowCount: 0 };
      },
    );

    await expect(
      publishCarouselPost(pool as never, "user-1", makePost(), makeSlides(4), { projectId: "proj-1" }),
    ).rejects.toThrow(/DB exploded/);

    const sqls = calls.map((c) => c.sql.trim().toUpperCase());
    expect(sqls.some((s) => s.startsWith("ROLLBACK"))).toBe(true);
    expect(sqls.some((s) => s.startsWith("COMMIT"))).toBe(false);
  });
});
