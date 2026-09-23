import { PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { initiateVideoCaptureUpload } from "./sound-room-storage-service.js";
import { buildVideoCaptureObjectKey } from "./video-capture-storage-contract.js";

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

describe("CreatorHub One video capture storage", () => {
  it("uses a CreatorHub project video-capture key, never Video Room or Role Room", () => {
    expect(buildVideoCaptureObjectKey(
      "Studio Nord",
      "owner@example.no",
      "10000000-0000-4000-8000-000000000002",
      "20000000-0000-4000-8000-000000000003",
      "A001 C004.MOV",
    )).toBe(
      "organizations/Studio-Nord/users/owner-example.no/projects/10000000-0000-4000-8000-000000000002/video-capture/assets/20000000-0000-4000-8000-000000000003/original.mov",
    );
  });

  it("creates a checksum-bound CreatorHub S3 upload for a raw take", async () => {
    const state = testPool();
    let signed: PutObjectCommand | null = null;
    const ticket = await initiateVideoCaptureUpload(state.pool, {
      userId: "owner-user",
      organizationId: "creatorhub-team",
      createdByUserId: "camera-operator",
      projectId: "10000000-0000-4000-8000-000000000002",
      assetId: "20000000-0000-4000-8000-000000000003",
      fileName: "A001-C004.mov",
      sizeBytes: 1024,
      contentType: "video/quicktime",
      checksumSha256: "b".repeat(64),
      channel: "capture-ios",
    }, {
      storage: {
        provider: "aws_s3",
        region: "eu-north-1",
        bucket: "creatorhub-test",
        client: {} as never,
      },
      signer: async (_client, command) => {
        signed = command as PutObjectCommand;
        return "https://creatorhub-test.s3.eu-north-1.amazonaws.com/signed";
      },
    });

    expect(ticket).toMatchObject({ strategy: "single", objectId: expect.any(String) });
    expect(signed).toBeInstanceOf(PutObjectCommand);
    expect(String(signed!.input.Key)).toMatch(
      /^organizations\/creatorhub-team\/users\/owner-user\/projects\/10000000-0000-4000-8000-000000000002\/video-capture\/assets\/[0-9a-f-]{36}\/original\.mov$/,
    );
    const insert = state.calls.find(({ sql }) => sql.includes("INSERT INTO role_room_storage_objects"));
    expect(insert?.params[7]).toBe("camera-operator");
    expect(insert?.params[12]).toBe("capture-ios");
    expect(insert?.params[13]).toBe("video-capture");
    expect(insert?.params[14]).toBeNull();
    expect(JSON.parse(String(insert?.params[8]))).toMatchObject({
      entityType: "video_capture_asset",
      entityId: "20000000-0000-4000-8000-000000000003",
    });
  });
});
