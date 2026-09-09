import { describe, expect, it, vi } from "vitest";
import { linkEaseVerseTrackToWorkspaceRoom } from "./project-workspace-routes";

const track = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "CreatorHub Sound Room E2E",
  artist: "CreatorHub",
  genre: "pop",
  bpm: 120,
  musical_key: "C",
};

describe("Workspace EaseVerse room linking", () => {
  it("adopts the existing unlinked Sound Room and keeps its Companion history", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM project_audio_rooms pr")) {
        return { rows: [{ id: "22222222-2222-4222-8222-222222222222", easeverse_track_id: null }] };
      }
      if (sql.includes("UPDATE audio_review_projects")) {
        return { rows: [{ id: "22222222-2222-4222-8222-222222222222" }] };
      }
      return { rows: [] };
    });

    const result = await linkEaseVerseTrackToWorkspaceRoom({
      pool: { query },
      workspaceProjectId: "workspace-1",
      userId: "user-1",
      track,
    });

    expect(result).toEqual({
      audioRoomId: "22222222-2222-4222-8222-222222222222",
      reusedWorkspaceRoom: true,
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO audio_review_projects"))).toBe(false);
    const companionUpdate = query.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE protools_companion_sessions"),
    );
    expect(companionUpdate?.[1]).toEqual([
      "22222222-2222-4222-8222-222222222222",
      "user-1",
      track.id,
    ]);
    expect(String(companionUpdate?.[0])).toContain("easeverse_track_id IS NULL");
  });

  it("does not overwrite a room that is already linked to another track", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM project_audio_rooms pr")) {
        return { rows: [{ id: "room-old", easeverse_track_id: "track-old" }] };
      }
      if (sql.includes("SELECT id FROM audio_review_projects")) {
        return { rows: [{ id: "33333333-3333-4333-8333-333333333333" }] };
      }
      return { rows: [] };
    });

    const result = await linkEaseVerseTrackToWorkspaceRoom({
      pool: { query },
      workspaceProjectId: "workspace-1",
      userId: "user-1",
      track,
    });

    expect(result).toEqual({
      audioRoomId: "33333333-3333-4333-8333-333333333333",
      reusedWorkspaceRoom: false,
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE audio_review_projects"))).toBe(false);
  });

  it("creates a new room only when neither the workspace nor the track has one", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("INSERT INTO audio_review_projects")) {
        return { rows: [{ id: "44444444-4444-4444-8444-444444444444" }] };
      }
      return { rows: [] };
    });

    const result = await linkEaseVerseTrackToWorkspaceRoom({
      pool: { query },
      workspaceProjectId: "workspace-1",
      userId: "user-1",
      track,
    });

    expect(result.audioRoomId).toBe("44444444-4444-4444-8444-444444444444");
    expect(result.reusedWorkspaceRoom).toBe(false);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO audio_review_projects"))).toBe(true);
  });
});
