import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("./easeverse-protools-sync.js", () => ({ pushProToolsSyncToEaseVerse: mocks.push }));
import { enqueueEaseVerseSync } from "./protools-companion-persistence.js";

describe("Pro Tools Companion durable EaseVerse outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.push.mockResolvedValue({ configured: true, synced: true, status: 200 });
  });

  it("assigns a revision, persists the canonical event, and marks it delivered", async () => {
    const query = vi.fn(async (sqlValue: unknown, params?: unknown[]) => {
      const sql = String(sqlValue);
      if (sql.startsWith("SELECT * FROM protools_easeverse_sync_outbox")) return { rows: [], rowCount: 0 };
      if (sql.startsWith("UPDATE protools_companion_sessions SET sync_revision")) return { rows: [{ sync_revision: 7 }], rowCount: 1 };
      if (sql.startsWith("INSERT INTO protools_easeverse_sync_outbox")) return { rows: [{
        id: "outbox-1", session_id: "session-1", event_id: params?.[2], revision: 7,
        attempt_count: 0, payload: JSON.parse(String(params?.[5])),
      }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const result = await enqueueEaseVerseSync({ pool: { query }, sessionId: "session-1", userId: "user-1",
      eventType: "markers", eventId: "file-1:markers", payload: { externalTrackId: "track-1", markers: [] } });
    expect(mocks.push).toHaveBeenCalledWith(expect.objectContaining({ schemaVersion: 1, eventId: "file-1:markers", revision: 7, ownerUserId: "user-1", proToolsSessionId: "session-1" }));
    expect(result).toMatchObject({ synced: true, queued: false, eventId: "file-1:markers", revision: 7 });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("status='delivered'"))).toBe(true);
  });

  it("does not deliver or increment again when an event is already delivered", async () => {
    const query = vi.fn(async () => ({ rows: [{ id: "outbox-1", session_id: "session-1", event_id: "file-1:markers", revision: 7, status: "delivered" }], rowCount: 1 }));
    const result = await enqueueEaseVerseSync({ pool: { query }, sessionId: "session-1", userId: "user-1",
      eventType: "markers", eventId: "file-1:markers", payload: { externalTrackId: "track-1", markers: [] } });
    expect(result).toEqual({ configured: true, synced: true, eventId: "file-1:markers", revision: 7, queued: false });
    expect(mocks.push).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledOnce();
  });
});
