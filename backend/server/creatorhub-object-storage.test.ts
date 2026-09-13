import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";

import {
  getCreatorHubObjectStorage,
  resetCreatorHubObjectStorageForTests,
} from "./creatorhub-object-storage.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  resetCreatorHubObjectStorageForTests();
});

describe("CreatorHub object storage", () => {
  it("allows checksum-bound browser and UXP uploads under CreatorHub tenant prefixes", () => {
    const policy = JSON.parse(fs.readFileSync(new URL(
      "../../infrastructure/aws/creatorhubn-storage/application-policy.json",
      import.meta.url,
    ), "utf8"));
    const cors = JSON.parse(fs.readFileSync(new URL(
      "../../infrastructure/aws/creatorhubn-storage/cors.json",
      import.meta.url,
    ), "utf8"));
    const objects = policy.Statement.find((statement: any) => statement.Sid === "CreatorHubObjectAccess");
    expect(objects.Action).toEqual(expect.arrayContaining([
      "s3:AbortMultipartUpload", "s3:GetObject", "s3:ListMultipartUploadParts", "s3:PutObject",
    ]));
    expect(objects.Resource).toContain(
      "arn:aws:s3:::creatorhubn-prod-745600963362-eu-north-1/organizations/*",
    );
    expect(cors.CORSRules[0]).toMatchObject({
      AllowedOrigins: ["*"],
      AllowedMethods: expect.arrayContaining(["GET", "HEAD", "PUT"]),
      ExposeHeaders: expect.arrayContaining(["ETag", "x-amz-checksum-sha256"]),
    });
  });

  it("binds the CreatorHub bucket to the intended runtime access key", async () => {
    process.env.AWS_ACCESS_KEY_ID = "creatorhub-key";
    process.env.AWS_SECRET_ACCESS_KEY = "creatorhub-secret";
    process.env.CREATORHUB_S3_BUCKET = "creatorhubn-test";
    process.env.CREATORHUB_S3_REGION = "eu-north-1";
    process.env.AWS_ROLE_ARN = "arn:aws:iam::123456789012:role/unrelated-role-room-role";
    process.env.AWS_WEB_IDENTITY_TOKEN_FILE = "/unrelated/role-room-token";

    const storage = getCreatorHubObjectStorage();
    expect(storage).toMatchObject({
      authentication: "creatorhub_access_key",
      provider: "aws_s3",
      bucket: "creatorhubn-test",
      region: "eu-north-1",
    });
    await expect(storage?.client.config.credentials()).resolves.toMatchObject({
      accessKeyId: "creatorhub-key",
    });
  });

  it("fails closed without the dedicated CreatorHub runtime configuration", () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    process.env.CREATORHUB_S3_BUCKET = "creatorhubn-test";
    process.env.AWS_ROLE_ARN = "arn:aws:iam::123456789012:role/role-room";
    process.env.AWS_WEB_IDENTITY_TOKEN_FILE = "/role-room-token";

    expect(getCreatorHubObjectStorage()).toBeNull();
  });
});
