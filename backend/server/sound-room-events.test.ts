import { afterEach, describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import {
  registerUserClientForTests,
  resetUserClientsForTests,
} from "./realtime-user-events";
import { broadcastSoundRoomUpdated } from "./sound-room-events";

class FakeSocket {
  readyState = 1;
  sent: string[] = [];
  private handlers = new Map<string, (() => void)[]>();

  send(data: string): void {
    this.sent.push(data);
  }

  on(event: string, handler: () => void): this {
    const handlers = this.handlers.get(event) ?? [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
    return this;
  }

  terminate(): void {
    this.readyState = 3;
  }
}

function register(userId: string): FakeSocket {
  const socket = new FakeSocket();
  registerUserClientForTests(userId, socket as unknown as WebSocket);
  return socket;
}

function routedPool() {
  return {
    async query(sql: string) {
      if (sql.includes("FROM project_audio_rooms")) {
        return { rows: [{ project_id: "workspace-1" }] };
      }
      if (sql.includes("FROM projects p")) {
        return { rows: [{ id: "workspace-1", user_id: "workspace-owner" }] };
      }
      if (sql.includes("FROM audio_review_projects")) {
        return { rows: [{ owner_user_id: "audio-owner" }] };
      }
      if (sql.includes("FROM project_team_members")) {
        return { rows: [{ user_id: "member-1" }, { user_id: "audio-owner" }] };
      }
      return { rows: [] };
    },
  };
}

describe("sound-room workspace event routing", () => {
  afterEach(() => resetUserClientsForTests());

  it("translates the audio id and broadcasts once to owners and active readers", async () => {
    const workspaceOwner = register("workspace-owner");
    const audioOwner = register("audio-owner");
    const member = register("member-1");
    const outsider = register("outsider");

    const result = await broadcastSoundRoomUpdated(
      routedPool() as any,
      "audio-room-1",
      "comment",
    );

    expect(result).toEqual({
      projectId: "workspace-1",
      recipientUserIds: ["workspace-owner", "member-1", "audio-owner"],
    });
    for (const socket of [workspaceOwner, audioOwner, member]) {
      expect(socket.sent).toHaveLength(2);
      const frame = JSON.parse(socket.sent[1]);
      expect(frame.event).toMatchObject({
        kind: "sound-room.updated",
        projectId: "workspace-1",
        reason: "comment",
      });
    }
    expect(outsider.sent).toHaveLength(1);
  });

  it("does not publish when the audio room is not linked to a workspace", async () => {
    const socket = register("workspace-owner");
    const pool = { query: async () => ({ rows: [] }) };
    await expect(
      broadcastSoundRoomUpdated(pool as any, "unlinked-room", "version"),
    ).resolves.toBeNull();
    expect(socket.sent).toHaveLength(1);
  });
});
