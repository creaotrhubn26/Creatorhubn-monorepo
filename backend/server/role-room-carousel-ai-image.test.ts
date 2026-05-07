import { describe, it, expect, vi } from "vitest";
import {
  generateAiImage,
  buildFinalPrompt,
  type AiGenerationContext,
} from "./role-room-carousel-ai-image.js";

function ctx(overrides: Partial<AiGenerationContext> = {}): AiGenerationContext {
  return {
    replicate: { run: vi.fn(async () => ["https://replicate-cdn/output.png"]) },
    r2: { upload: vi.fn(async (k) => `https://r2/carousel/${k}`) },
    pool: {
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    } as never,
    ...overrides,
  };
}

describe("buildFinalPrompt", () => {
  it("appends brand-colour + cinematography modifiers", () => {
    const final = buildFinalPrompt({
      userId: "u1",
      prompt: "a fresh sourdough bread",
      brandColors: { primary: "#8b3a1f", secondary: "#d4a574", accent: "#f4e8d0" },
      aspectRatio: "1:1",
    });
    expect(final).toContain("a fresh sourdough bread");
    expect(final).toContain("#8b3a1f");
    expect(final).toContain("cinematic lighting");
    expect(final).toContain("editorial photography");
  });

  it("returns base prompt when enrichWithBrand=false", () => {
    const final = buildFinalPrompt({
      userId: "u1",
      prompt: "minimal product shot",
      brandColors: { primary: "#fff", secondary: "#000", accent: "#aaa" },
      aspectRatio: "1:1",
      enrichWithBrand: false,
    });
    expect(final).toBe("minimal product shot");
  });
});

describe("generateAiImage", () => {
  it("calls Replicate + uploads to R2 + caches", async () => {
    const c = ctx();
    const out = await generateAiImage(c, {
      userId: "u1",
      prompt: "fresh bread",
      brandColors: { primary: "#8b3a1f", secondary: "#d4a574", accent: "#f4e8d0" },
      aspectRatio: "1:1",
    });

    expect(out.cached).toBe(false);
    expect(out.cost).toBeGreaterThan(0);
    expect(c.replicate.run).toHaveBeenCalledOnce();

    const replicateInput = (c.replicate.run as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as Record<string, unknown>;
    expect(replicateInput.width).toBe(1024);
    expect(replicateInput.height).toBe(1024);
    expect((replicateInput.prompt as string).toLowerCase()).toContain("bread");

    // Cache INSERT was attempted
    const queryCalls = (c.pool.query as ReturnType<typeof vi.fn>).mock.calls;
    const insertCall = queryCalls.find((args) =>
      (args[0] as string).includes("INSERT INTO carousel_ai_image_cache"),
    );
    expect(insertCall).toBeTruthy();
  });

  it("returns cache hit without calling Replicate", async () => {
    const c = ctx({
      pool: {
        query: vi.fn(async (sql: string) => {
          if (sql.includes("SELECT generated_url")) {
            return {
              rows: [
                {
                  generated_url: "https://r2/cached.png",
                  model: "stability-ai/sdxl",
                  cost: "0.0035",
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
      } as never,
    });

    const out = await generateAiImage(c, {
      userId: "u1",
      prompt: "cached prompt",
      brandColors: { primary: "#000", secondary: "#fff", accent: "#aaa" },
      aspectRatio: "1:1",
    });
    expect(out.cached).toBe(true);
    expect(out.cost).toBe(0);
    expect(out.generatedUrl).toBe("https://r2/cached.png");
    expect(c.replicate.run).not.toHaveBeenCalled();
  });

  it("uses portrait dimensions for 4:5 aspect", async () => {
    const c = ctx();
    await generateAiImage(c, {
      userId: "u1",
      prompt: "x",
      brandColors: { primary: "#000", secondary: "#fff", accent: "#aaa" },
      aspectRatio: "4:5",
    });
    const replicateInput = (c.replicate.run as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as Record<string, unknown>;
    expect(replicateInput.width).toBe(832);
    expect(replicateInput.height).toBe(1024);
  });

  it("uses 16:9 dimensions for 1.91:1 aspect (FB landscape)", async () => {
    const c = ctx();
    await generateAiImage(c, {
      userId: "u1",
      prompt: "x",
      brandColors: { primary: "#000", secondary: "#fff", accent: "#aaa" },
      aspectRatio: "1.91:1",
    });
    const replicateInput = (c.replicate.run as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as Record<string, unknown>;
    expect(replicateInput.width).toBe(1280);
    expect(replicateInput.height).toBe(720);
  });

  it("falls back to upstream URL when R2 mirror fails", async () => {
    const c = ctx({
      r2: {
        upload: vi.fn(async () => {
          throw new Error("R2 down");
        }),
      },
    });

    // Mock global fetch to return a response so the mirror attempt happens
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })) as never;

    const out = await generateAiImage(c, {
      userId: "u1",
      prompt: "x",
      brandColors: { primary: "#000", secondary: "#fff", accent: "#aaa" },
      aspectRatio: "1:1",
    });
    expect(out.generatedUrl).toBe("https://replicate-cdn/output.png");

    globalThis.fetch = originalFetch;
  });

  it("propagates Replicate failures", async () => {
    const c = ctx({
      replicate: {
        run: vi.fn(async () => {
          throw new Error("Replicate exploded");
        }),
      },
    });
    await expect(
      generateAiImage(c, {
        userId: "u1",
        prompt: "x",
        brandColors: { primary: "#000", secondary: "#fff", accent: "#aaa" },
        aspectRatio: "1:1",
      }),
    ).rejects.toThrow("Replicate exploded");
  });

  it("caches identical input under same hash", async () => {
    const c1 = ctx();
    const c2 = ctx();

    const queryCalls1: string[] = [];
    (c1.pool.query as ReturnType<typeof vi.fn>).mockImplementation(
      async (sql: string, _params?: unknown[]) => {
        queryCalls1.push(sql);
        return { rows: [], rowCount: 0 };
      },
    );
    const queryCalls2: string[] = [];
    (c2.pool.query as ReturnType<typeof vi.fn>).mockImplementation(
      async (sql: string, _params?: unknown[]) => {
        queryCalls2.push(sql);
        return { rows: [], rowCount: 0 };
      },
    );

    const input = {
      userId: "u1",
      prompt: "same prompt",
      brandColors: { primary: "#000", secondary: "#fff", accent: "#aaa" },
      aspectRatio: "1:1" as const,
    };
    await generateAiImage(c1, input);
    await generateAiImage(c2, input);

    // The cache-lookup SELECT in each call has the same cache_key param
    const select1 = (c1.pool.query as ReturnType<typeof vi.fn>).mock.calls.find(
      (args) => (args[0] as string).includes("SELECT generated_url"),
    );
    const select2 = (c2.pool.query as ReturnType<typeof vi.fn>).mock.calls.find(
      (args) => (args[0] as string).includes("SELECT generated_url"),
    );
    expect(select1?.[1]).toEqual(select2?.[1]);
  });
});
