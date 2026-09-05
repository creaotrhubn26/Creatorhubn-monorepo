import { describe, expect, it, vi } from "vitest";
import type { RoleRoomFeedPostInput } from "./role-room-feed-plan.js";
import { applyFeedPostImageLocked } from "./role-room-feed-post-image.js";

function post(overrides: Partial<RoleRoomFeedPostInput> = {}): RoleRoomFeedPostInput {
  return {
    id: "post-1",
    concept: "educational",
    title: "Original title",
    caption: "Original caption",
    hashtags: ["#medside"],
    callToAction: "Les mer",
    imageStyle: "clean",
    approvalState: "draft",
    ...overrides,
  };
}

function poolHarness(options: { post: RoleRoomFeedPostInput; linkExists?: boolean }) {
  const queries: Array<{ sql: string; args: unknown[] }> = [];
  let savedPosts: RoleRoomFeedPostInput[] | null = null;
  const query = vi.fn(async (sql: string, args: unknown[] = []) => {
    queries.push({ sql, args });
    if (sql.includes("FROM role_room_feed_mockup_links")) {
      return { rows: options.linkExists === false ? [] : [{ exists: 1 }] };
    }
    if (sql.includes("FROM role_room_feed_plans")) {
      return { rows: [{ posts: [options.post] }] };
    }
    if (sql.includes("UPDATE role_room_feed_plans")) {
      savedPosts = JSON.parse(String(args[0]));
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
  const release = vi.fn();
  return {
    pool: { connect: vi.fn(async () => ({ query, release })) },
    queries,
    query,
    release,
    savedPosts: () => savedPosts,
  };
}

const baseInput = {
  workspaceProjectId: "workspace-1",
  platform: "instagram" as const,
  feedPostId: "post-1",
  imageDataUrl: "data:image/png;base64,QUJD",
  imageName: "medside-feed.png",
  updatedBy: "user-1",
};

const link = {
  id: "00000000-0000-4000-8000-000000000001",
  mockupProjectId: "mockup-1",
  mockupCreatedBy: "user-1",
  revision: 4,
  confirmApprovedAssetChange: false,
};

describe("applyFeedPostImageLocked", () => {
  it("takes the shared feed-plan lock and preserves all non-image post fields", async () => {
    const harness = poolHarness({ post: post({ scheduledFor: "2026-09-08T10:00:00.000Z" }) });
    const result = await applyFeedPostImageLocked(harness.pool as never, { ...baseInput, link });

    expect(result).toMatchObject({ ok: true, changed: true, approvalState: "draft" });
    expect(harness.queries[0].sql).toBe("BEGIN");
    expect(harness.queries[1].sql).toContain("pg_advisory_xact_lock");
    expect(harness.queries[1].args).toEqual(["workspace-1::instagram"]);
    expect(harness.savedPosts()?.[0]).toMatchObject({
      title: "Original title",
      caption: "Original caption",
      scheduledFor: "2026-09-08T10:00:00.000Z",
      customImageUrl: baseInput.imageDataUrl,
      customImageName: baseInput.imageName,
    });
    expect(harness.queries.some(({ sql }) => sql.includes("UPDATE role_room_feed_mockup_links"))).toBe(true);
    const linkUpdate = harness.queries.find(({ sql }) => sql.includes("UPDATE role_room_feed_mockup_links"));
    expect(linkUpdate?.sql.match(/\$3::varchar\(64\)/g)).toHaveLength(2);
    expect(harness.queries.at(-1)?.sql).toBe("COMMIT");
    expect(harness.release).toHaveBeenCalledOnce();
  });

  it("is idempotent when the post already contains the exact same render", async () => {
    const harness = poolHarness({
      post: post({
        approvalState: "approved",
        customImageUrl: baseInput.imageDataUrl,
        customImageName: baseInput.imageName,
      }),
    });
    const result = await applyFeedPostImageLocked(harness.pool as never, { ...baseInput, link });

    expect(result).toMatchObject({ ok: true, changed: false, approvalState: "approved" });
    expect(harness.queries.some(({ sql }) => sql.includes("UPDATE role_room_feed_plans"))).toBe(false);
    expect(harness.queries.filter(({ sql }) => sql.includes("UPDATE role_room_feed_mockup_links"))).toHaveLength(1);
  });

  it("requires explicit confirmation before replacing an approved asset", async () => {
    const harness = poolHarness({ post: post({ approvalState: "approved" }) });
    const result = await applyFeedPostImageLocked(harness.pool as never, { ...baseInput, link });

    expect(result).toEqual({
      ok: false,
      reason: "approval_confirmation_required",
      approvalState: "approved",
    });
    expect(harness.queries.some(({ sql }) => sql.includes("UPDATE role_room_feed_plans"))).toBe(false);
    expect(harness.queries.at(-1)?.sql).toBe("ROLLBACK");
  });

  it("resets approval audit fields when the confirmed design replacement is applied", async () => {
    const harness = poolHarness({
      post: post({
        approvalState: "scheduled",
        approvalChangedBy: "reviewer-1",
        reviewRequestedAt: "2026-09-01T10:00:00.000Z",
        reviewRequestedBy: "producer-1",
        reviewDeadline: "2026-09-04T10:00:00.000Z",
      }),
    });
    const result = await applyFeedPostImageLocked(harness.pool as never, {
      ...baseInput,
      link: { ...link, confirmApprovedAssetChange: true },
    });

    expect(result).toMatchObject({ ok: true, changed: true, approvalState: "needs_changes" });
    expect(harness.savedPosts()?.[0]).toMatchObject({
      approvalState: "needs_changes",
      approvalChangedBy: "user-1",
      reviewRequestedAt: null,
      reviewRequestedBy: null,
      reviewDeadline: null,
    });
  });

  it("never replaces the historical asset on an already published post", async () => {
    const harness = poolHarness({ post: post({ approvalState: "published" }) });
    const result = await applyFeedPostImageLocked(harness.pool as never, {
      ...baseInput,
      link: { ...link, confirmApprovedAssetChange: true },
    });
    expect(result).toEqual({ ok: false, reason: "published_post_locked", approvalState: "published" });
    expect(harness.queries.some(({ sql }) => sql.includes("UPDATE role_room_feed_plans"))).toBe(false);
  });

  it("rolls back if the immutable link tuple no longer exists", async () => {
    const harness = poolHarness({ post: post(), linkExists: false });
    const result = await applyFeedPostImageLocked(harness.pool as never, { ...baseInput, link });
    expect(result).toEqual({ ok: false, reason: "link_not_found" });
    expect(harness.queries.some(({ sql }) => sql.includes("FROM role_room_feed_plans"))).toBe(false);
    expect(harness.queries.at(-1)?.sql).toBe("ROLLBACK");
  });
});
