import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  addBusinessDaysIso,
  isPublishable,
  shouldAutoApprove,
  computeReviewDeadlineIso,
  assertPostPublishable,
  submitPostsForReview,
  runMaterialAutoApproveSweep,
  isClientActor,
  canTransitionToPublishable,
  getApprovalPolicy,
  MaterialNotApprovedError,
} from "./role-room-material-approval.js";
import type { RoleRoomFeedPostInput } from "./role-room-feed-plan.js";

function post(overrides: Partial<RoleRoomFeedPostInput> = {}): RoleRoomFeedPostInput {
  return {
    id: "p1",
    concept: "",
    title: "",
    caption: "",
    hashtags: [],
    callToAction: "",
    imageStyle: "",
    approvalState: "draft",
    ...overrides,
  };
}

function feedRow(platform: string, posts: RoleRoomFeedPostInput[]) {
  return {
    id: `plan-${platform}`,
    project_id: "proj-1",
    platform,
    posts,
    brand_snapshot: null,
    updated_by: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

/**
 * Wrap a query impl into a pool that also supports the connect()/client path
 * used by mutateFeedPlanLocked (BEGIN/SELECT … FOR UPDATE/INSERT/COMMIT).
 * BEGIN/COMMIT/ROLLBACK resolve empty; everything else routes through impl.
 */
function txPool(
  impl: (sql: string, params: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>,
): Pool {
  const clientQuery = async (sql: string, params: unknown[] = []) => {
    const verb = sql.trim().toUpperCase();
    if (verb === "BEGIN" || verb === "COMMIT" || verb === "ROLLBACK") return { rows: [] };
    // Transaction-scoped advisory lock taken before the SELECT … FOR UPDATE.
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    return impl(sql, params);
  };
  return {
    query: vi.fn((sql: string, params: unknown[] = []) => impl(sql, params)),
    connect: vi.fn(async () => ({ query: vi.fn(clientQuery), release: vi.fn() })),
  } as unknown as Pool;
}

describe("addBusinessDaysIso", () => {
  it("never lands on a weekend", () => {
    for (let d = 1; d <= 12; d++) {
      const day = new Date(addBusinessDaysIso("2026-05-20T10:00:00.000Z", d)).getUTCDay();
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
    }
  });

  it("Friday + 1 business day = Monday (skips the weekend)", () => {
    const d = new Date("2026-06-01T10:00:00.000Z");
    while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
    const friday = d.toISOString();
    const res = addBusinessDaysIso(friday, 1);
    expect(new Date(res).getUTCDay()).toBe(1);
    expect(new Date(res).getTime() - new Date(friday).getTime()).toBe(3 * 24 * 3600 * 1000);
  });

  it("skips supplied holidays", () => {
    // Monday + 1 business day would be Tuesday; mark Tuesday a holiday → Wednesday.
    const d = new Date("2026-06-01T10:00:00.000Z");
    while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
    const monday = d.toISOString();
    const tuesday = new Date(new Date(monday).getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10);
    const res = addBusinessDaysIso(monday, 1, [tuesday]);
    expect(new Date(res).getUTCDay()).toBe(3); // Wednesday
  });
});

describe("isPublishable", () => {
  it("only approved/scheduled/published pass the gate", () => {
    expect(isPublishable("approved")).toBe(true);
    expect(isPublishable("scheduled")).toBe(true);
    expect(isPublishable("published")).toBe(true);
    expect(isPublishable("draft")).toBe(false);
    expect(isPublishable("awaiting_client")).toBe(false);
    expect(isPublishable("needs_changes")).toBe(false);
    expect(isPublishable("rejected")).toBe(false);
    expect(isPublishable(null)).toBe(false);
  });
});

describe("shouldAutoApprove", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  it("true when awaiting_client and past the deadline", () => {
    expect(shouldAutoApprove({ approvalState: "awaiting_client", reviewDeadline: "2026-06-09T12:00:00.000Z" }, now)).toBe(true);
  });
  it("false before the deadline", () => {
    expect(shouldAutoApprove({ approvalState: "awaiting_client", reviewDeadline: "2026-06-11T12:00:00.000Z" }, now)).toBe(false);
  });
  it("false when not awaiting_client or no deadline", () => {
    expect(shouldAutoApprove({ approvalState: "draft", reviewDeadline: "2026-06-01T12:00:00.000Z" }, now)).toBe(false);
    expect(shouldAutoApprove({ approvalState: "awaiting_client", reviewDeadline: null }, now)).toBe(false);
  });
});

describe("computeReviewDeadlineIso", () => {
  it("returns a future business-day timestamp", () => {
    const deadline = computeReviewDeadlineIso("2026-06-01T10:00:00.000Z", 3);
    expect(new Date(deadline).getTime()).toBeGreaterThan(new Date("2026-06-01T10:00:00.000Z").getTime());
    expect(new Date(deadline).getUTCDay()).not.toBe(0);
    expect(new Date(deadline).getUTCDay()).not.toBe(6);
  });
});

describe("assertPostPublishable (§5.1 gate)", () => {
  function poolWithPost(p: RoleRoomFeedPostInput) {
    return {
      query: vi.fn(async (sql: string, params: unknown[]) => {
        if (/FROM role_room_feed_plans\s+WHERE project_id/i.test(sql)) {
          // Only the 'instagram' plan carries the post.
          return params[1] === "instagram"
            ? { rows: [feedRow("instagram", [p])], rowCount: 1 }
            : { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;
  }

  it("passes for an approved post", async () => {
    await expect(
      assertPostPublishable(poolWithPost(post({ approvalState: "approved" })), "proj-1", "p1"),
    ).resolves.toBeUndefined();
  });

  it("throws MaterialNotApprovedError for a draft post", async () => {
    await expect(
      assertPostPublishable(poolWithPost(post({ approvalState: "draft" })), "proj-1", "p1"),
    ).rejects.toBeInstanceOf(MaterialNotApprovedError);
  });

  it("throws when material is unlinked (fail-closed)", async () => {
    const pool = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) } as unknown as Pool;
    await expect(assertPostPublishable(pool, "proj-1", null)).rejects.toBeInstanceOf(
      MaterialNotApprovedError,
    );
    // allowUnlinked escape hatch
    await expect(assertPostPublishable(pool, "proj-1", null, { allowUnlinked: true })).resolves.toBeUndefined();
  });
});

describe("submitPostsForReview", () => {
  it("moves posts to awaiting_client with a deadline", async () => {
    let savedPosts: RoleRoomFeedPostInput[] = [];
    const pool = txPool(async (sql: string, params: unknown[]) => {
      if (/FROM role_room_feed_plans\s+WHERE project_id/i.test(sql)) {
        return { rows: [feedRow("instagram", [post({ id: "p1" }), post({ id: "p2" })])], rowCount: 1 };
      }
      if (/INSERT INTO role_room_feed_plans/i.test(sql)) {
        savedPosts = JSON.parse(params[2] as string);
        return { rows: [feedRow("instagram", savedPosts)], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const result = await submitPostsForReview(pool, "proj-1", "instagram", ["p1"], "daniel@x.no");
    expect(result.submitted).toBe(1);
    expect(result.deadline).toBeTruthy();
    const p1 = savedPosts.find((p) => p.id === "p1")!;
    expect(p1.approvalState).toBe("awaiting_client");
    expect(p1.reviewDeadline).toBe(result.deadline);
    expect(p1.reviewRequestedBy).toBe("daniel@x.no");
    // untouched post stays draft
    expect(savedPosts.find((p) => p.id === "p2")!.approvalState).toBe("draft");
  });
});

describe("runMaterialAutoApproveSweep (§5.2)", () => {
  it("auto-approves overdue awaiting_client posts only", async () => {
    let savedPosts: RoleRoomFeedPostInput[] = [];
    const overdue = post({ id: "p1", approvalState: "awaiting_client", reviewDeadline: "2026-06-01T00:00:00.000Z" });
    const future = post({ id: "p2", approvalState: "awaiting_client", reviewDeadline: "2999-01-01T00:00:00.000Z" });
    const pool = txPool(async (sql: string, params: unknown[]) => {
      // The list scan (containment query) the sweep starts with.
      if (/posts @>/i.test(sql)) {
        return { rows: [feedRow("instagram", [overdue, future])], rowCount: 1 };
      }
      // The per-plan row lock the mutate re-reads under.
      if (/FROM role_room_feed_plans\s+WHERE project_id/i.test(sql)) {
        return { rows: [feedRow("instagram", [overdue, future])], rowCount: 1 };
      }
      if (/INSERT INTO role_room_feed_plans/i.test(sql)) {
        savedPosts = JSON.parse(params[2] as string);
        return { rows: [feedRow("instagram", savedPosts)], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const summary = await runMaterialAutoApproveSweep(pool, new Date("2026-06-10T12:00:00.000Z"));
    expect(summary.postsAutoApproved).toBe(1);
    expect(savedPosts.find((p) => p.id === "p1")!.approvalState).toBe("approved");
    expect(savedPosts.find((p) => p.id === "p1")!.approvalChangedBy).toBe("system:auto-approval");
    expect(savedPosts.find((p) => p.id === "p2")!.approvalState).toBe("awaiting_client");
  });

  it("returns an empty summary when nothing is awaiting", async () => {
    const pool = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) } as unknown as Pool;
    const summary = await runMaterialAutoApproveSweep(pool);
    expect(summary.plansScanned).toBe(0);
    expect(summary.postsAutoApproved).toBe(0);
  });
});

describe("approval policy (client decides — §5.1)", () => {
  it("isClientActor recognises client roles only", () => {
    expect(isClientActor("client")).toBe(true);
    expect(isClientActor("client_reviewer")).toBe(true);
    expect(isClientActor("CLIENT_REVIEWER")).toBe(true);
    expect(isClientActor("producer")).toBe(false);
    expect(isClientActor("director")).toBe(false);
    expect(isClientActor(null)).toBe(false);
  });

  it("canTransitionToPublishable: system always, else gated on policy + role", () => {
    // System (auto-approval) always allowed.
    expect(canTransitionToPublishable({ requireClientApproval: true, isSystem: true })).toBe(true);
    // Policy off → anyone may approve.
    expect(canTransitionToPublishable({ requireClientApproval: false, actorRole: "producer" })).toBe(true);
    // Policy on → only client.
    expect(canTransitionToPublishable({ requireClientApproval: true, actorRole: "producer" })).toBe(false);
    expect(canTransitionToPublishable({ requireClientApproval: true, actorRole: "client_reviewer" })).toBe(true);
  });

  it("getApprovalPolicy defaults to requireClientApproval=true", async () => {
    const emptyPool = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) } as unknown as Pool;
    expect((await getApprovalPolicy(emptyPool, "proj-1")).requireClientApproval).toBe(true);

    const offPool = {
      query: vi.fn(async () => ({ rows: [{ require_client_approval: false }], rowCount: 1 })),
    } as unknown as Pool;
    expect((await getApprovalPolicy(offPool, "proj-1")).requireClientApproval).toBe(false);
  });
});
