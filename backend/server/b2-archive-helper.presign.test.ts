import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { presignRoleRoomB2Download, presignRoleRoomB2Upload } from "./b2-archive-helper.js";

const ENV_KEYS = [
  "B2_ROLE_ROOM_APPLICATION_KEY_ID",
  "B2_ROLE_ROOM_APPLICATION_KEY",
  "B2_ROLE_ROOM_BUCKET_NAME",
] as const;

describe("Role Room B2 presigned PUT contract", () => {
  const previous = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of ENV_KEYS) previous.set(key, process.env[key]);
    process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID = "test-key-id";
    process.env.B2_ROLE_ROOM_APPLICATION_KEY = "test-application-key";
    process.env.B2_ROLE_ROOM_BUCKET_NAME = "test-bucket";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    previous.clear();
  });

  it("signs declared MIME and length without binding an empty-payload checksum", async () => {
    const signed = await presignRoleRoomB2Upload(
      "workspace/project-1/video-versions/clip",
      "video/mp4",
      3600,
      123,
    );

    expect(signed).toBeTruthy();
    const url = new URL(String(signed));
    const signedHeaders = String(url.searchParams.get("X-Amz-SignedHeaders") || "").split(";");
    expect(signedHeaders).toEqual(expect.arrayContaining(["content-length", "content-type", "host"]));
    expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
    expect(url.searchParams.has("x-amz-sdk-checksum-algorithm")).toBe(false);
  });

  it("pins download URLs to the confirmed Backblaze object version", async () => {
    const signed = await presignRoleRoomB2Download(
      "workspace/project-1/video-versions/clip",
      undefined,
      3600,
      "version-confirmed-1",
    );

    expect(signed).toBeTruthy();
    expect(new URL(String(signed)).searchParams.get("versionId")).toBe("version-confirmed-1");
  });
});
