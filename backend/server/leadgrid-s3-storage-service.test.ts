import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const aws = vi.hoisted(() => {
  const sent: unknown[] = [];
  const responses: unknown[] = [];
  class Command {
    constructor(public readonly input: Record<string, unknown>) {}
  }
  class S3Client {
    async send(command: unknown) {
      sent.push(command);
      return responses.length ? responses.shift() : {};
    }
  }
  return {
    sent,
    responses,
    S3Client,
    PutObjectCommand: class PutObjectCommand extends Command {},
    GetObjectCommand: class GetObjectCommand extends Command {},
    HeadObjectCommand: class HeadObjectCommand extends Command {},
    CopyObjectCommand: class CopyObjectCommand extends Command {},
    DeleteObjectCommand: class DeleteObjectCommand extends Command {},
    getSignedUrl: vi.fn(async () => "https://signed.example/object"),
  };
});

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: aws.S3Client,
  PutObjectCommand: aws.PutObjectCommand,
  GetObjectCommand: aws.GetObjectCommand,
  HeadObjectCommand: aws.HeadObjectCommand,
  CopyObjectCommand: aws.CopyObjectCommand,
  DeleteObjectCommand: aws.DeleteObjectCommand,
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: aws.getSignedUrl,
}));

import {
  createLeadgridObjectStorage,
  leadgridStorageKeys,
  opaqueLeadgridStorageId,
  readLeadgridS3Config,
} from "./leadgrid-s3-storage-service.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const leadId = "22222222-2222-4222-8222-222222222222";
const assetId = "33333333-3333-4333-8333-333333333333";
const bucket = "leadgrid-prod-745600963362-eu-north-1";

describe("Leadgrid S3 configuration and key contract", () => {
  beforeEach(() => {
    aws.sent.length = 0;
    aws.responses.length = 0;
    aws.getSignedUrl.mockClear();
  });

  it("requires the four product-local environment variables", () => {
    expect(readLeadgridS3Config({})).toBeNull();
    expect(readLeadgridS3Config({
      AWS_ACCESS_KEY_ID: "global-must-not-be-used",
      AWS_SECRET_ACCESS_KEY: "global-must-not-be-used",
    })).toBeNull();

    expect(readLeadgridS3Config({
      AWS_LEADGRID_ACCESS_KEY_ID: "key",
      AWS_LEADGRID_SECRET_ACCESS_KEY: "secret",
      AWS_LEADGRID_BUCKET_NAME: bucket,
      AWS_LEADGRID_REGION: "eu-north-1",
    })).toMatchObject({ bucket, region: "eu-north-1" });
  });

  it("fails closed when the configured bucket is outside the account contract", () => {
    expect(() => readLeadgridS3Config({
      AWS_LEADGRID_ACCESS_KEY_ID: "key",
      AWS_LEADGRID_SECRET_ACCESS_KEY: "secret",
      AWS_LEADGRID_BUCKET_NAME: "another-product-bucket",
      AWS_LEADGRID_REGION: "eu-north-1",
    })).toThrow("AWS_LEADGRID_BUCKET_NAME");
  });

  it("maps legacy text project IDs to stable opaque UUID segments", () => {
    const first = opaqueLeadgridStorageId("dentum-oslo");
    const second = opaqueLeadgridStorageId("dentum-oslo");
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(first).not.toContain("dentum");

    const key = leadgridStorageKeys.leadAttachment({
      organizationId,
      projectId: "dentum-oslo",
      leadId,
      assetId,
    });
    expect(key).toMatch(
      new RegExp(`^organizations/${organizationId}/projects/[0-9a-f-]{36}/leads/${leadId}/attachments/${assetId}/original$`),
    );
    expect(key).not.toContain("dentum-oslo");
  });

  it("uploads encrypted bytes with checksum and creates short-lived signed reads", async () => {
    const storage = createLeadgridObjectStorage({
      accessKeyId: "key",
      secretAccessKey: "secret",
      bucket,
      region: "eu-north-1",
    });
    const key = leadgridStorageKeys.leadAttachment({
      organizationId,
      projectId: "dentum-oslo",
      leadId,
      assetId,
    });
    const result = await storage.putObject({
      key,
      body: Buffer.from("verified-content"),
      contentType: "text/plain",
      purpose: "lead_attachment",
    });

    expect(result).toMatchObject({ provider: "aws_s3", bucket, key, sizeBytes: 16 });
    expect(result.checksumSha256).toMatch(/^[0-9a-f]{64}$/);
    const put = aws.sent[0] as InstanceType<typeof aws.PutObjectCommand>;
    expect(put.input).toMatchObject({
      Bucket: bucket,
      Key: key,
      ServerSideEncryption: "AES256",
      ExpectedBucketOwner: "745600963362",
      CacheControl: "private, no-store",
      ContentType: "text/plain",
    });
    expect(put.input.ChecksumSHA256).toBeTypeOf("string");

    await storage.createDownloadUrl(key, 900);
    expect(aws.getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(aws.GetObjectCommand),
      { expiresIn: 900 },
    );
  });

  it("allows direct PUT URLs only below an opaque temporary Academy key", async () => {
    const storage = createLeadgridObjectStorage({
      accessKeyId: "key",
      secretAccessKey: "secret",
      bucket,
      region: "eu-north-1",
    });
    const key = leadgridStorageKeys.temporaryAcademyVideo({
      organizationId,
      chapterId: leadId,
      uploadId: assetId,
    });
    await storage.createUploadUrl({ key, contentType: "video/mp4" });
    const signedCommand = aws.getSignedUrl.mock.calls[0]?.[1] as InstanceType<typeof aws.PutObjectCommand>;
    expect(signedCommand.input).toMatchObject({
      Bucket: bucket,
      Key: key,
      ContentType: "video/mp4",
    });
    expect(signedCommand.input).not.toHaveProperty("CacheControl");

    await expect(storage.createUploadUrl({
      key: `organizations/${organizationId}/unsafe`,
      contentType: "video/mp4",
    })).rejects.toThrow("temporary");
  });

  it("validates and finalizes a temporary object before deleting the source", async () => {
    const storage = createLeadgridObjectStorage({
      accessKeyId: "key",
      secretAccessKey: "secret",
      bucket,
      region: "eu-north-1",
    });
    const temporaryKey = leadgridStorageKeys.temporaryAcademyVideo({
      organizationId,
      chapterId: leadId,
      uploadId: assetId,
    });
    const finalKey = leadgridStorageKeys.academyVideo({
      organizationId,
      courseId: "44444444-4444-4444-8444-444444444444",
      chapterId: leadId,
      assetId,
    });
    const prefix = Buffer.concat([
      Buffer.from([0, 0, 0, 24]),
      Buffer.from("ftypisom", "ascii"),
    ]);
    aws.responses.push(
      { ContentLength: 128, ContentType: "video/mp4" },
      { Body: { transformToByteArray: async () => prefix } },
      { CopyObjectResult: { ChecksumSHA256: Buffer.alloc(32, 7).toString("base64") } },
      {},
    );

    const finalized = await storage.finalizeTemporaryObject({
      temporaryKey,
      finalKey,
      allowedContentTypes: ["video/mp4"],
      maxBytes: 1024,
      purpose: "academy_video",
      validatePrefix: (body) => body.subarray(4, 8).toString("ascii") === "ftyp",
    });

    expect(finalized).toMatchObject({
      key: finalKey,
      sizeBytes: 128,
      contentType: "video/mp4",
      checksumSha256: Buffer.alloc(32, 7).toString("hex"),
    });
    expect(aws.sent.map((command) => command.constructor.name)).toEqual([
      "HeadObjectCommand",
      "GetObjectCommand",
      "CopyObjectCommand",
      "DeleteObjectCommand",
    ]);
    const copy = aws.sent[2] as InstanceType<typeof aws.CopyObjectCommand>;
    expect(copy.input).toMatchObject({
      Key: finalKey,
      ChecksumAlgorithm: "SHA256",
      ServerSideEncryption: "AES256",
      MetadataDirective: "REPLACE",
    });
  });
});

describe("migration 0568", () => {
  it("moves Leadgrid metadata ownership away from the Role Room ledger", () => {
    const sql = readFileSync(
      new URL("../migrations/0568_leadgrid_aws_s3_storage.sql", import.meta.url),
      "utf8",
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS leadgrid_storage_objects");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS leadgrid_org_storage_usage");
    expect(sql).toContain("leadgrid_lead_files_storage_object_fkey");
    expect(sql).toContain("storage_provider = 'aws_s3'");
    expect(sql).toContain("ON DELETE RESTRICT");
    expect(sql).toContain("video_storage_provider");
    expect(sql).toContain("image_storage_provider");
    expect(sql).toContain("leadgrid_reject_storage_identity_change");
    expect(sql).toContain("leadgrid_bind_prize_storage_object");
  });
});
