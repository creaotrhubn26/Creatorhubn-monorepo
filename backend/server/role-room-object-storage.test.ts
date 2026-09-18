import { afterEach, describe, expect, it } from "vitest";
import {
  getConfiguredRoleRoomStorageProvider,
  getRoleRoomObjectStorage,
  resetRoleRoomStorageClientsForTests,
} from "./role-room-object-storage.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  resetRoleRoomStorageClientsForTests();
});

describe("role-room-object-storage", () => {
  it("defaults to AWS and requires an explicit opt-in for the legacy B2 rollback", () => {
    delete process.env.ROLE_ROOM_STORAGE_PROVIDER;
    expect(getConfiguredRoleRoomStorageProvider()).toBe("aws_s3");
  });

  it("uses the AWS Role Room bucket when aws_s3 is selected", async () => {
    process.env.ROLE_ROOM_STORAGE_PROVIDER = "aws_s3";
    process.env.AWS_ROLE_ROOM_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_ROLE_ROOM_SECRET_ACCESS_KEY = "test-secret";
    process.env.AWS_ROLE_ROOM_BUCKET_NAME = "role-room-test";
    process.env.AWS_ROLE_ROOM_REGION = "eu-north-1";

    const storage = getRoleRoomObjectStorage();
    expect(getConfiguredRoleRoomStorageProvider()).toBe("aws_s3");
    expect(storage?.provider).toBe("aws_s3");
    expect(storage?.authentication).toBe("static_access_key");
    expect(storage?.bucket).toBe("role-room-test");
    await expect(storage?.client.config.region()).resolves.toBe("eu-north-1");
  });

  it("prefers Render web identity over a long-lived access key", async () => {
    process.env.ROLE_ROOM_STORAGE_PROVIDER = "aws_s3";
    process.env.AWS_ROLE_ARN = "arn:aws:iam::123456789012:role/role-room-runtime";
    process.env.AWS_WEB_IDENTITY_TOKEN_FILE = "/var/run/secrets/render-oidc-token";
    process.env.AWS_ROLE_ROOM_ACCESS_KEY_ID = "legacy-access-key";
    process.env.AWS_ROLE_ROOM_SECRET_ACCESS_KEY = "legacy-secret";
    process.env.AWS_ROLE_ROOM_BUCKET_NAME = "role-room-test";
    process.env.AWS_ROLE_ROOM_REGION = "eu-north-1";

    const storage = getRoleRoomObjectStorage();
    expect(storage?.provider).toBe("aws_s3");
    expect(storage?.authentication).toBe("render_web_identity");
    await expect(storage?.client.config.region()).resolves.toBe("eu-north-1");
  });

  it("fails closed when web identity is incomplete and no static fallback exists", () => {
    process.env.ROLE_ROOM_STORAGE_PROVIDER = "aws_s3";
    process.env.AWS_ROLE_ARN = "arn:aws:iam::123456789012:role/role-room-runtime";
    delete process.env.AWS_WEB_IDENTITY_TOKEN_FILE;
    delete process.env.AWS_ROLE_ROOM_ACCESS_KEY_ID;
    delete process.env.AWS_ROLE_ROOM_SECRET_ACCESS_KEY;
    process.env.AWS_ROLE_ROOM_BUCKET_NAME = "role-room-test";

    expect(getRoleRoomObjectStorage()).toBeNull();
  });

  it("fails closed when the selected AWS config is incomplete", () => {
    process.env.ROLE_ROOM_STORAGE_PROVIDER = "aws_s3";
    delete process.env.AWS_ROLE_ROOM_SECRET_ACCESS_KEY;
    process.env.AWS_ROLE_ROOM_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_ROLE_ROOM_BUCKET_NAME = "role-room-test";

    expect(getRoleRoomObjectStorage()).toBeNull();
  });

  it("keeps Backblaze B2 as the explicit rollback provider", () => {
    process.env.ROLE_ROOM_STORAGE_PROVIDER = "backblaze_b2";
    process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID = "test-key-id";
    process.env.B2_ROLE_ROOM_APPLICATION_KEY = "test-key";
    process.env.B2_ROLE_ROOM_BUCKET_NAME = "role-room-b2-test";

    const storage = getRoleRoomObjectStorage();
    expect(storage?.provider).toBe("backblaze_b2");
    expect(storage?.bucket).toBe("role-room-b2-test");
  });
});
