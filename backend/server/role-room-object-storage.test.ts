import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";

const aws = vi.hoisted(() => ({
  tokenFileOptions: [] as Array<Record<string, unknown>>,
  oidcCredentialProvider: vi.fn(async () => ({
    accessKeyId: "temporary-role-key",
    secretAccessKey: "temporary-role-secret",
  })),
}));

vi.mock("@aws-sdk/credential-providers", () => ({
  fromTokenFile: vi.fn((options: Record<string, unknown>) => {
    aws.tokenFileOptions.push(options);
    return aws.oidcCredentialProvider;
  }),
}));
import {
  getConfiguredRoleRoomStorageProvider,
  getRoleRoomObjectStorage,
  resetRoleRoomStorageClientsForTests,
} from "./role-room-object-storage.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
  aws.tokenFileOptions.length = 0;
  resetRoleRoomStorageClientsForTests();
});

describe("role-room-object-storage", () => {
  it("preserves Role Room prefixes and restricts CORS to Role Room web origins", () => {
    const policy = JSON.parse(fs.readFileSync(new URL(
      "../../infrastructure/aws/role-room-storage/application-policy.json",
      import.meta.url,
    ), "utf8"));
    const cors = JSON.parse(fs.readFileSync(new URL(
      "../../infrastructure/aws/role-room-storage/cors.json",
      import.meta.url,
    ), "utf8"));
    const provision = fs.readFileSync(new URL(
      "../../infrastructure/aws/role-room-storage/provision.sh",
      import.meta.url,
    ), "utf8");
    const metadata = policy.Statement.find((statement: any) => statement.Sid === "RoleRoomBucketMetadata");
    const objects = policy.Statement.find((statement: any) => statement.Sid === "RoleRoomObjectAccess");
    const productionPrefixes = [
      "agencies/*", "education/*", "exports/*", "organizations/*", "platform/*", "projects/*",
      "quarantine/*", "talents/*", "temporary/*", "users/*", "workspaces/*",
    ];
    expect(metadata.Condition.StringLike["s3:prefix"]).toEqual(expect.arrayContaining(productionPrefixes));
    expect(objects.Resource).toEqual(expect.arrayContaining(productionPrefixes.map(
      (prefix) => `arn:aws:s3:::the-role-room-prod-745600963362-eu-north-1/${prefix}`,
    )));
    expect(objects.Action).toEqual(expect.arrayContaining([
      "s3:AbortMultipartUpload", "s3:GetObject", "s3:ListMultipartUploadParts", "s3:PutObject",
    ]));
    expect(cors.CORSRules[0]).toMatchObject({
      AllowedOrigins: ["https://theroleroom.com", "https://www.theroleroom.com"],
      AllowedMethods: expect.arrayContaining(["GET", "HEAD", "PUT"]),
      ExposeHeaders: expect.arrayContaining(["ETag", "x-amz-checksum-sha256"]),
    });
    expect(provision).toContain("aws iam create-policy-version");
    expect(provision).toContain("--set-as-default");
    expect(provision).toContain("already has five versions");
    expect(provision).toContain("TheRoleRoomStorageRuntimeProd");
  });

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
    expect(aws.tokenFileOptions).toEqual([{
      roleArn: "arn:aws:iam::123456789012:role/role-room-runtime",
      webIdentityTokenFile: "/var/run/secrets/render-oidc-token",
      roleSessionName: "the-role-room-object-storage",
      clientConfig: { region: "eu-north-1" },
    }]);
    await expect(storage?.client.config.credentials()).resolves.toMatchObject({
      accessKeyId: "temporary-role-key",
    });
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
