import { describe, expect, it } from "vitest";
import { buildSoundRoomObjectKey, extractLegacyB2Key, validatedSoundRoomRange } from "./sound-room-storage-contract.js";

describe("Sound Room storage identity and legacy B2 migration", () => {
  it("maps browser and Pro Tools files into the same private object hierarchy", () => {
    const first = buildSoundRoomObjectKey("user@example.test", "project-1", "object-1", "Mix.WAV");
    const second = buildSoundRoomObjectKey("user@example.test", "project-1", "object-2", "Bounce.wav");
    expect(first).toMatch(/^users\/[a-f0-9]{32}\/sound-room\/project-1\/object-1\/original\.wav$/);
    expect(second.replace("object-2", "object-1")).toBe(first);
    expect(first).not.toContain("user@example.test");
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
