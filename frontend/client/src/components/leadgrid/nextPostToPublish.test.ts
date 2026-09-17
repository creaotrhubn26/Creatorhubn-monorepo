import { describe, expect, it } from "vitest";
import { buildPublishQueue, defaultCaptionFor, isLinkedInPost } from "./nextPostToPublish";
import type { MarketingPlanPost } from "@/components/role-room/services/roleRoomAgentService";

const post = (over: Partial<MarketingPlanPost> = {}): MarketingPlanPost => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  planId: "plan-1",
  pillarId: null,
  sortOrder: 0,
  dayOffset: 0,
  hook: "Hook",
  format: "linkedin_post",
  script: null,
  captionDraft: "Utkast",
  callToAction: "Book en prat",
  primaryPlatform: "linkedin",
  crossPostPlan: [],
  goalKpi: null,
  status: "proposed",
  feedPlanPostId: null,
  scheduledFor: null,
  publishedAt: null,
  createdAt: "2026-09-17T00:00:00Z",
  updatedAt: "2026-09-17T00:00:00Z",
  ...over,
});

describe("buildPublishQueue", () => {
  it("picks the earliest unpublished LinkedIn post by dayOffset, then sortOrder", () => {
    const q = buildPublishQueue([
      post({ id: "c", dayOffset: 4, sortOrder: 0 }),
      post({ id: "b", dayOffset: 2, sortOrder: 1 }),
      post({ id: "a", dayOffset: 2, sortOrder: 0 }),
      post({ id: "z", dayOffset: null, sortOrder: 0 }),
    ]);
    expect(q.next?.id).toBe("a");
    expect(q.remaining).toBe(4);
    expect(q.total).toBe(4);
  });

  it("skips published, skipped and already-externally-published posts", () => {
    const q = buildPublishQueue([
      post({ id: "done", dayOffset: 0, status: "published" }),
      post({ id: "ext", dayOffset: 1, externalPostId: "123" }),
      post({ id: "skip", dayOffset: 2, status: "skipped" }),
      post({ id: "next", dayOffset: 3 }),
    ]);
    expect(q.next?.id).toBe("next");
    expect(q.published).toBe(2);
    expect(q.remaining).toBe(1);
  });

  it("ignores posts for other platforms and reports an empty queue honestly", () => {
    const q = buildPublishQueue([
      post({ id: "ig", primaryPlatform: "instagram", format: "reel" }),
      post({ id: "tt", primaryPlatform: "tiktok", format: "tiktok" }),
    ]);
    expect(q.next).toBeNull();
    expect(q.total).toBe(0);
    expect(q.remaining).toBe(0);
  });

  it("treats an unknown platform with LinkedIn format as LinkedIn", () => {
    expect(isLinkedInPost(post({ primaryPlatform: null, format: "linkedin_post" }))).toBe(true);
    expect(isLinkedInPost(post({ primaryPlatform: null, format: "reel" }))).toBe(false);
  });
});

describe("defaultCaptionFor", () => {
  it("joins caption draft and CTA, falling back to the hook", () => {
    expect(defaultCaptionFor(post())).toBe("Utkast\n\nBook en prat");
    expect(defaultCaptionFor(post({ captionDraft: null, callToAction: "  " }))).toBe("Hook");
  });
});
