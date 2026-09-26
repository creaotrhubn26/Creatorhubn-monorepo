import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pushReference: vi.fn() }));

vi.mock("./easeverse-protools-sync.js", () => ({
  pushApprovedReferenceMixToEaseVerse: mocks.pushReference,
}));

import { retryMusicOutboxForUser } from "./music-integration-outbox.js";

describe("EaseVerse approved-reference recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pushReference.mockResolvedValue({ configured: true, synced: true, status: 200 });
  });

  it("lets the owner explicitly retry a dead-lettered approved reference", async () => {
    const query = vi.fn(async (sqlValue: unknown, params?: unknown[]) => {
      const sql = String(sqlValue);
      if (sql.includes("WITH due AS")) {
        expect(sql).toContain("'dead_letter'");
        expect(params?.[0]).toBe("user-1");
        return { rows: [{
          id: "outbox-1",
          event_id: "reference:version-1:approval-1",
          attempt_count: 12,
          payload: { ownerUserId: "user-1", externalTrackId: "track-1", url: "https://creatorhub.test/mix.wav" },
        }] };
      }
      if (sql.includes("SELECT COUNT(*)::int AS count")) return { rows: [{ count: 0 }] };
      return { rows: [] };
    });

    const result = await retryMusicOutboxForUser({ query }, "user-1", 10);

    expect(result).toEqual({ attempted: 1, delivered: 1, pending: 0 });
    expect(mocks.pushReference).toHaveBeenCalledWith(expect.objectContaining({ externalTrackId: "track-1" }));
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status='delivered'"),
      ["outbox-1", 13],
    );
  });
});
