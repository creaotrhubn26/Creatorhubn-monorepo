import { describe, expect, it, vi } from "vitest";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { initiateVideoRoomUpload } from "./sound-room-storage-service.js";

function testPool() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (statement: string, params: unknown[] = []) => {
    const sql = String(statement);
    calls.push({ sql, params });
    if (sql.includes("INSERT INTO role_room_storage_accounts")) {
      return { rows: [{
        id: "10000000-0000-4000-8000-000000000001",
        organization_id: null,
        plan_key: "solo_free",
        base_quota_bytes: String(5 * 1024 ** 3),
        used_bytes: "0",
        reserved_bytes: "0",
        file_count: 0,
        stripe_subscription_id: null,
        stripe_subscription_status: null,
        stripe_current_period_end: null,
        stripe_cancel_at_period_end: false,
        billing_grace_until: null,
        status: "active",
      }] };
    }
    if (sql.includes("role_room_reserve_storage")) {
      return { rows: [{ role_room_reserve_storage: true }] };
    }
    return { rows: [], rowCount: 1 };
  });
  return { pool: { query } as never, calls };
}

describe("Video Room object storage", () => {
  it("creates a checksum-bound private S3 upload charged to the project owner", async () => {
    const state = testPool();
    let signedCommand: PutObjectCommand | null = null;
    const ticket = await initiateVideoRoomUpload(state.pool, {
      userId: "owner-user",
      organizationId: "creatorhub-team",
      createdByUserId: "team-editor",
      projectId: "10000000-0000-4000-8000-000000000002",
      fileName: "Review V2.mp4",
      sizeBytes: 1024,
      contentType: "video/mp4",
      checksumSha256: "a".repeat(64),
      channel: "premiere",
    }, {
      storage: {
        provider: "aws_s3",
        region: "eu-north-1",
        bucket: "creatorhub-test",
        client: {} as never,
      },
      signer: async (_client, command) => {
        signedCommand = command as PutObjectCommand;
        return "https://creatorhub-test.s3.eu-north-1.amazonaws.com/signed";
      },
    });

    expect(ticket).toMatchObject({ strategy: "single", expiresInSeconds: 3600 });
    expect(signedCommand).toBeInstanceOf(PutObjectCommand);
    expect(signedCommand!.input).toMatchObject({
      Bucket: "creatorhub-test",
      ContentType: "video/mp4",
      ChecksumAlgorithm: "SHA256",
      ChecksumSHA256: "qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=",
    });
    expect(ticket.requiredHeaders).toMatchObject({
      "content-type": "video/mp4",
      "x-amz-sdk-checksum-algorithm": "SHA256",
      "x-amz-checksum-sha256": "qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=",
    });
    expect(String(signedCommand!.input.Key)).toMatch(
      /^organizations\/creatorhub-team\/users\/owner-user\/projects\/10000000-0000-4000-8000-000000000002\/video-room\/versions\/[0-9a-f-]{36}\/original\.mp4$/,
    );
    const inserted = state.calls.find(({ sql }) => sql.includes("INSERT INTO role_room_storage_objects"));
    expect(inserted?.params[7]).toBe("team-editor");
    expect(inserted?.params[12]).toBe("premiere");
    expect(inserted?.params[13]).toBe("video-room");
    expect(inserted?.params[14]).toBeNull();
  });

  it("rejects a non-video payload before reserving storage", async () => {
    const state = testPool();
    await expect(initiateVideoRoomUpload(state.pool, {
      userId: "owner-user",
      createdByUserId: "team-editor",
      projectId: "10000000-0000-4000-8000-000000000002",
      fileName: "payload.pdf",
      sizeBytes: 1024,
      contentType: "application/pdf",
      checksumSha256: "a".repeat(64),
      channel: "premiere",
    }, { storage: {} as never })).rejects.toThrow("unsupported_video_type");
    expect(state.calls.some(({ sql }) => sql.includes("role_room_reserve_storage"))).toBe(false);
  });

  it("keeps UXP checksum headers in SigV4 SignedHeaders", async () => {
    const state = testPool();
    const ticket = await initiateVideoRoomUpload(state.pool, {
      userId: "owner-user",
      createdByUserId: "owner-user",
      projectId: "10000000-0000-4000-8000-000000000002",
      fileName: "Review V3.mp4",
      sizeBytes: 1024,
      contentType: "video/mp4",
      checksumSha256: "a".repeat(64),
      channel: "premiere",
    }, {
      storage: {
        provider: "aws_s3",
        region: "eu-north-1",
        bucket: "creatorhub-test",
        client: new S3Client({
          region: "eu-north-1",
          credentials: {
            accessKeyId: "AKIAEXAMPLEEXAMPLE",
            secretAccessKey: "x".repeat(40),
          },
        }),
      },
    });

    const uploadUrl = new URL(ticket.uploadUrl!);
    expect(uploadUrl.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual([
      "host",
      "x-amz-checksum-sha256",
      "x-amz-sdk-checksum-algorithm",
    ]);
    expect(uploadUrl.searchParams.has("x-amz-checksum-sha256")).toBe(false);
    expect(uploadUrl.searchParams.has("x-amz-sdk-checksum-algorithm")).toBe(false);
  });
});
