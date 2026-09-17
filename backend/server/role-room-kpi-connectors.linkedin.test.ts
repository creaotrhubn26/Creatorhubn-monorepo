/**
 * LinkedIn-KPI-connectoren (Markedssjef-modus fase 1b): poster publisert
 * direkte fra markedsplanen (external_post_id) får likes/kommentarer fra
 * socialActions som KPI-snapshots. Feed-planner-poster uten ekstern id og
 * poster uten token/404 hoppes stille over.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

vi.mock("./social-publisher-linkedin.js", () => ({
  decryptLinkedInToken: (value: string | null) => (value ? `tok:${value}` : null),
}));
vi.mock("./role-room-tiktok-oauth.js", () => ({ ensureFreshTikTokConnection: vi.fn() }));
vi.mock("./client-portal-connected-platforms.js", () => ({ getProjectProducerUserId: vi.fn() }));
vi.mock("./role-room-tiktok-insights.js", () => ({ fetchTikTokVideoMetrics: vi.fn() }));

import { fetchLinkedInKpisForPosts } from "./role-room-kpi-connectors";

function makePool(tokens: Record<string, string | null>, planOwner: string | null = "owner-1"): Pool {
  return {
    query: vi.fn(async (sql: string, args: unknown[]) => {
      if (sql.includes("FROM role_room_linkedin_connections")) {
        const userId = String(args[0]);
        return { rows: userId in tokens && tokens[userId] ? [{ access_token_encrypted: tokens[userId] }] : [] };
      }
      if (sql.includes("FROM role_room_marketing_plans")) {
        return { rows: planOwner ? [{ owner_user_id: planOwner }] : [] };
      }
      return { rows: [] };
    }),
  } as unknown as Pool;
}

function makeFetch(byPostId: Record<string, { likes?: number; comments?: number } | null>) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${url}|${(init?.headers as Record<string, string>)?.Authorization ?? ""}`);
    const id = decodeURIComponent(url.split("/socialActions/")[1] ?? "").replace("urn:li:ugcPost:", "");
    const body = byPostId[id];
    if (!body) return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        likesSummary: body.likes === undefined ? undefined : { totalLikes: body.likes },
        commentsSummary: body.comments === undefined ? undefined : { totalFirstLevelComments: body.comments },
      }),
    } as unknown as Response;
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

const now = () => new Date("2026-09-17T10:00:00Z");

beforeEach(() => vi.clearAllMocks());

function makeOrgStatsFetch(byPostId: Record<string, Record<string, number>>) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${url}|${(init?.headers as Record<string, string>)?.["LinkedIn-Version"] ?? ""}`);
    if (!url.includes("/rest/organizationalEntityShareStatistics")) {
      return { ok: false, status: 403, json: async () => ({}) } as unknown as Response;
    }
    const elements = Object.entries(byPostId).map(([id, t]) => ({
      ugcPost: `urn:li:ugcPost:${id}`,
      totalShareStatistics: t,
    }));
    return { ok: true, status: 200, json: async () => ({ elements }) } as unknown as Response;
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

describe("fetchLinkedInKpisForPosts — bedriftsposter", () => {
  it("reads organization share statistics in one batched call per organisation", async () => {
    const pool = makePool({ "markedssjef-1": "enc-a" });
    const { fetchImpl, calls } = makeOrgStatsFetch({
      "111": { impressionCount: 1200, uniqueImpressionsCount: 900, clickCount: 40, likeCount: 12, commentCount: 3, shareCount: 1, engagement: 0.0467 },
      "112": { impressionCount: 300, clickCount: 5, likeCount: 2, commentCount: 0, shareCount: 0, engagement: 0.0233 },
    });
    const snapshots = await fetchLinkedInKpisForPosts(
      pool,
      "lg-x",
      "plan-1",
      [
        { id: "a", feedPlanPostId: null, primaryPlatform: "linkedin", externalPostId: "111", publishedByUserId: "markedssjef-1", publishedAuthorUrn: "urn:li:organization:42" },
        { id: "b", feedPlanPostId: null, primaryPlatform: "linkedin", externalPostId: "112", publishedByUserId: "markedssjef-1", publishedAuthorUrn: "urn:li:organization:42" },
      ],
      { fetchImpl, now },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("organizationalEntity=urn%3Ali%3Aorganization%3A42");
    expect(calls[0]).toContain("urn%3Ali%3AugcPost%3A111");
    expect(calls[0]).toContain("urn%3Ali%3AugcPost%3A112");
    expect(calls[0].split("|")[1]).toMatch(/^\d{6}$/); // LinkedIn-Version header satt
    const a = snapshots.filter((s) => s.postId === "a");
    expect(Object.fromEntries(a.map((s) => [s.metric, s.value]))).toEqual({
      impressions: 1200,
      unique_impressions: 900,
      clicks: 40,
      likes: 12,
      comments: 3,
      shares: 1,
      engagement_rate: 0.0467,
      engagement: 16,
    });
    const b = snapshots.filter((s) => s.postId === "b");
    expect(b.find((s) => s.metric === "unique_impressions")).toBeUndefined();
    expect(b.find((s) => s.metric === "impressions")?.value).toBe(300);
    expect(snapshots.every((s) => s.source === "linkedin_pages" && s.platform === "linkedin")).toBe(true);
  });

  it("stays silent (no snapshots) when LinkedIn refuses the statistics call", async () => {
    const pool = makePool({ "owner-1": "enc" });
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })) as unknown as typeof fetch;
    const snapshots = await fetchLinkedInKpisForPosts(
      pool,
      "lg-x",
      "plan-1",
      [{ id: "a", feedPlanPostId: null, primaryPlatform: "linkedin", externalPostId: "1", publishedByUserId: null, publishedAuthorUrn: "urn:li:organization:42" }],
      { fetchImpl, now },
    );
    expect(snapshots).toEqual([]);
  });
});

describe("fetchLinkedInKpisForPosts", () => {
  it("writes likes, comments and engagement for posts with an external id, using the publisher's token", async () => {
    const pool = makePool({ "markedssjef-1": "enc-a" });
    const { fetchImpl, calls } = makeFetch({ "111": { likes: 12, comments: 3 } });
    const snapshots = await fetchLinkedInKpisForPosts(
      pool,
      "lg-leadgrid-abc",
      "plan-1",
      [
        { id: "post-a", feedPlanPostId: null, primaryPlatform: "linkedin", externalPostId: "111", publishedByUserId: "markedssjef-1" },
        { id: "post-feed", feedPlanPostId: "feed-1", primaryPlatform: "linkedin", externalPostId: null, publishedByUserId: null },
        { id: "post-ig", feedPlanPostId: null, primaryPlatform: "instagram", externalPostId: "999", publishedByUserId: "markedssjef-1" },
      ],
      { fetchImpl, now },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("urn%3Ali%3AugcPost%3A111");
    expect(calls[0]).toContain("Bearer tok:enc-a");
    expect(snapshots.map((s) => [s.metric, s.value])).toEqual([
      ["likes", 12],
      ["comments", 3],
      ["engagement", 15],
    ]);
    expect(snapshots[0]).toMatchObject({
      postId: "post-a",
      planId: "plan-1",
      platform: "linkedin",
      source: "linkedin_pages",
      capturedAt: now(),
    });
  });

  it("falls back to the plan owner's token when published_by_user_id is missing", async () => {
    const pool = makePool({ "owner-1": "enc-owner" });
    const { fetchImpl, calls } = makeFetch({ "222": { likes: 1, comments: 0 } });
    const snapshots = await fetchLinkedInKpisForPosts(
      pool,
      "lg-x",
      "plan-1",
      [{ id: "p", feedPlanPostId: null, primaryPlatform: null, externalPostId: "222", publishedByUserId: null }],
      { fetchImpl, now },
    );
    expect(calls[0]).toContain("Bearer tok:enc-owner");
    expect(snapshots).toHaveLength(3);
  });

  it("returns nothing for deleted posts (404) or when no token exists, without throwing", async () => {
    const pool = makePool({ "owner-1": "enc-owner", "u-no-token": null });
    const { fetchImpl, calls } = makeFetch({});
    const snapshots = await fetchLinkedInKpisForPosts(
      pool,
      "lg-x",
      "plan-1",
      [
        { id: "gone", feedPlanPostId: null, primaryPlatform: "linkedin", externalPostId: "404", publishedByUserId: "owner-1" },
        { id: "no-token", feedPlanPostId: null, primaryPlatform: "linkedin", externalPostId: "5", publishedByUserId: "u-no-token" },
      ],
      { fetchImpl, now },
    );
    expect(snapshots).toEqual([]);
    // Bare posten med token ble spurt om; posten uten token kaller aldri LinkedIn.
    expect(calls).toHaveLength(1);
  });

  it("does not call LinkedIn at all when no post has an external id", async () => {
    const pool = makePool({ "owner-1": "enc" });
    const { fetchImpl, calls } = makeFetch({});
    const snapshots = await fetchLinkedInKpisForPosts(
      pool,
      "lg-x",
      "plan-1",
      [{ id: "p", feedPlanPostId: "feed-1", primaryPlatform: "linkedin" }],
      { fetchImpl, now },
    );
    expect(snapshots).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
