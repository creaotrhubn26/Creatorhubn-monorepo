import { describe, expect, it, vi } from "vitest";
import {
  LINKEDIN_SHARE_STATS_BATCH,
  fetchOrganizationShareStatistics,
} from "./social-linkedin-org-share-stats";

function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: (init?.headers as Record<string, string>) ?? {} });
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

describe("fetchOrganizationShareStatistics", () => {
  it("builds the versioned REST request and maps totalShareStatistics per post", async () => {
    const { fetchImpl, calls } = fakeFetch(200, {
      elements: [
        {
          ugcPost: "urn:li:ugcPost:111",
          totalShareStatistics: {
            impressionCount: 1500,
            uniqueImpressionsCount: 1100,
            clickCount: 60,
            likeCount: 20,
            commentCount: 4,
            shareCount: 2,
            engagement: 0.0573,
          },
        },
        { share: "urn:li:share:222", totalShareStatistics: { impressionCount: 10 } },
        { totalShareStatistics: { impressionCount: 99 } }, // uten referanse → droppes
      ],
    });
    const stats = await fetchOrganizationShareStatistics(
      "urn:li:organization:42",
      ["urn:li:ugcPost:111", "222", "111"],
      "tok",
      fetchImpl,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/rest/organizationalEntityShareStatistics?q=organizationalEntity");
    expect(calls[0].url).toContain("organizationalEntity=urn%3Ali%3Aorganization%3A42");
    expect(calls[0].url).toContain("ugcPosts=List(urn%3Ali%3AugcPost%3A111,urn%3Ali%3AugcPost%3A222)");
    expect(calls[0].headers.Authorization).toBe("Bearer tok");
    expect(calls[0].headers["LinkedIn-Version"]).toMatch(/^\d{6}$/);
    expect(calls[0].headers["X-Restli-Protocol-Version"]).toBe("2.0.0");
    expect(stats).toEqual([
      {
        postId: "111",
        impressions: 1500,
        uniqueImpressions: 1100,
        clicks: 60,
        likes: 20,
        comments: 4,
        shares: 2,
        engagementRate: 0.0573,
      },
      {
        postId: "222",
        impressions: 10,
        uniqueImpressions: null,
        clicks: null,
        likes: null,
        comments: null,
        shares: null,
        engagementRate: null,
      },
    ]);
  });

  it("returns null on 403 (missing scope or page role) instead of throwing", async () => {
    const { fetchImpl } = fakeFetch(403, { message: "Not enough permissions" });
    expect(await fetchOrganizationShareStatistics("urn:li:organization:42", ["1"], "tok", fetchImpl)).toBeNull();
  });

  it("refuses non-organisation URNs and empty post lists without calling LinkedIn", async () => {
    const { fetchImpl, calls } = fakeFetch(200, { elements: [] });
    expect(await fetchOrganizationShareStatistics("urn:li:person:abc", ["1"], "tok", fetchImpl)).toBeNull();
    expect(await fetchOrganizationShareStatistics("urn:li:organization:42", [], "tok", fetchImpl)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("caps a single call at the batch size", async () => {
    const { fetchImpl, calls } = fakeFetch(200, { elements: [] });
    const ids = Array.from({ length: LINKEDIN_SHARE_STATS_BATCH + 10 }, (_, i) => String(i + 1));
    await fetchOrganizationShareStatistics("urn:li:organization:42", ids, "tok", fetchImpl);
    const list = calls[0].url.split("ugcPosts=List(")[1];
    expect(list.split(",").length).toBe(LINKEDIN_SHARE_STATS_BATCH);
  });
});
