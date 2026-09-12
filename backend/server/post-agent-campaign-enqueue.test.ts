import { describe, expect, it } from "vitest";

import { validateEnqueue, enqueueCampaignPosts } from "./post-agent-campaign-enqueue.js";

describe("validateEnqueue", () => {
  it("mapper linkedin→linkedin og feed/reels/stories→instagram", () => {
    const r = validateEnqueue({ posts: [
      { platform: "linkedin", body: "A" },
      { platform: "feed", body: "B" },
      { platform: "reels", body: "C" },
    ] });
    expect(r.skipped).toBe(0);
    expect(r.posts.map((p) => p.platform)).toEqual(["linkedin", "instagram", "instagram"]);
  });

  it("hopper over tiktok/youtube (køen støtter dem ikke) + tomme body", () => {
    const r = validateEnqueue({ posts: [
      { platform: "tiktok", body: "X" },
      { platform: "youtube", body: "Y" },
      { platform: "linkedin", body: "  " },
      { platform: "linkedin", body: "OK" },
    ] });
    expect(r.posts).toHaveLength(1);
    expect(r.skipped).toBe(3);
  });

  it("ikke-array / rart input → tomt", () => {
    expect(validateEnqueue(null).posts).toEqual([]);
    expect(validateEnqueue({ posts: "nope" }).posts).toEqual([]);
  });

  it("kapper body til 3000 tegn + beholder facts-array", () => {
    const r = validateEnqueue({ posts: [{ platform: "linkedin", body: "x".repeat(5000), facts: [{ label: "A", value: "1" }] }] });
    expect(r.posts[0].body).toHaveLength(3000);
    expect(r.posts[0].facts).toEqual([{ label: "A", value: "1" }]);
  });
});

describe("enqueueCampaignPosts", () => {
  it("setter inn kun gyldige poster og returnerer created/skipped", async () => {
    const calls: unknown[][] = [];
    const pool = { query: async (_sql: string, params: unknown[]) => { calls.push(params); return { rows: [] }; } };
    const r = await enqueueCampaignPosts(pool as never, "11111111-1111-1111-1111-111111111111", {
      posts: [{ platform: "linkedin", body: "A" }, { platform: "tiktok", body: "B" }],
    });
    expect(r).toEqual({ created: 1, skipped: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toBe("linkedin"); // platform-param
  });
});
