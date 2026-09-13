import { describe, expect, it } from "vitest";
import { buildSoundRoomObjectKey, extractLegacyB2Key, validatedSoundRoomRange } from "./sound-room-storage-contract.js";

describe("Sound Room storage identity and legacy B2 migration", () => {
  it("maps browser and Pro Tools files into the same private object hierarchy", () => {
    const first = buildSoundRoomObjectKey({
      organizationId: "org-1", userId: "user-1", workspaceProjectId: "workspace-1",
      projectId: "audio-room-1", sessionId: "session-1", channel: "protools",
      objectId: "object-1", fileName: "Mix.WAV",
    });
    const second = buildSoundRoomObjectKey({
      organizationId: "org-1", userId: "user-1", workspaceProjectId: "workspace-1",
      projectId: "audio-room-1", channel: "browser", objectId: "object-2", fileName: "Bounce.wav",
    });
    expect(first).toBe("organizations/org-1/users/user-1/projects/workspace-1/sound-room/audio-room-1/protools/sessions/session-1/bounces/object-1/original.wav");
    expect(second).toBe("organizations/org-1/users/user-1/projects/workspace-1/sound-room/audio-room-1/browser/uploads/object-2/original.wav");
  });

  it("accepts supported B2 object URLs and rejects arbitrary import URLs", () => {
    expect(extractLegacyB2Key("b2://legacy-audio/projects/p1/mix.wav", "legacy-audio")).toBe("projects/p1/mix.wav");
    expect(extractLegacyB2Key("https://f003.backblazeb2.com/file/legacy-audio/projects%2Fp1%2Fmix.wav?Authorization=secret", "legacy-audio")).toBe("projects/p1/mix.wav");
    expect(extractLegacyB2Key("https://legacy-audio.s3.eu-central-003.backblazeb2.com/projects/p1/mix.wav", "legacy-audio")).toBe("projects/p1/mix.wav");
    expect(extractLegacyB2Key("https://example.com/legacy-audio/projects/p1/mix.wav", "legacy-audio")).toBeNull();
    expect(extractLegacyB2Key("b2://another-bucket/projects/p1/mix.wav", "legacy-audio")).toBeNull();
  });

  it("accepts a single audio byte range and fails closed for multi-range", () => {
    expect(validatedSoundRoomRange("bytes=100-199")).toBe("bytes=100-199");
    expect(validatedSoundRoomRange("bytes=-256")).toBe("bytes=-256");
    expect(validatedSoundRoomRange("bytes=0-1,4-5")).toBe(false);
  });
});
