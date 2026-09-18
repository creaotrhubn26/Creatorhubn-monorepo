import { describe, expect, it, vi } from "vitest";

import { enqueueEaseVerseSync, type PoolLike } from "./protools-companion-persistence.js";

describe("enqueueEaseVerseSync", () => {
  it("returns an already delivered event without incrementing the session revision", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM protools_easeverse_sync_outbox")) {
        return {
          rows: [{
            id: "outbox-1",
            event_id: "bounce-event-1",
            revision: 7,
            status: "delivered",
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await enqueueEaseVerseSync({
      pool: { query } as PoolLike,
      sessionId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      eventType: "bounce",
      eventId: " bounce-event-1 ",
      payload: { externalTrackId: "track-1", markers: [] },
    });

    expect(result).toEqual({
      configured: true,
      synced: true,
      eventId: "bounce-event-1",
      revision: 7,
      queued: false,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).not.toContain("sync_revision=sync_revision+1");
  });
});
