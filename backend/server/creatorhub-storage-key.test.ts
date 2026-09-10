import { describe, expect, it } from "vitest";
import { creatorHubSessionPrefix, creatorHubSoundRoomBounceKey } from "./creatorhub-storage-key.js";

describe("CreatorHub tenant storage keys", () => {
  it("keeps organization, user, workspace, Sound Room and session in a stable hierarchy", () => {
    const key = creatorHubSoundRoomBounceKey({
      organizationId: "org-1",
      userId: "user-1",
      workspaceProjectId: "project-1",
      audioRoomId: "room-1",
      sessionId: "session-1",
      objectId: "object-1",
      fileName: "Mix final.wav",
    });
    expect(key).toBe("organizations/org-1/users/user-1/projects/project-1/sound-room/room-1/protools/sessions/session-1/bounces/object-1-Mix-final.wav");
    expect(key.startsWith(creatorHubSessionPrefix({
      organizationId: "org-1", userId: "user-1", workspaceProjectId: "project-1", audioRoomId: "room-1", sessionId: "session-1",
    }))).toBe(true);
  });

  it("uses a personal tenant and strips traversal characters", () => {
    const key = creatorHubSoundRoomBounceKey({
      userId: "../user/42",
      sessionId: "../../session",
      objectId: "obj",
      fileName: "../secret.wav",
    });
    expect(key).toContain("organizations/personal-user-42/users/user-42/");
    expect(key).not.toContain("../");
  });
});
