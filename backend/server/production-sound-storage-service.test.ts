import { PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { initiateProductionSoundUpload } from "./sound-room-storage-service.js";

function testPool() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (statement: string, params: unknown[] = []) => {
    const sql = String(statement);
    calls.push({ sql, params });
    if (sql.includes("INSERT INTO role_room_storage_accounts")) {
      return {
        rows: [
          {
            id: "10000000-0000-4000-8000-000000000001",
            organization_id: "studio-nord",
            plan_key: "solo_free",
            base_quota_bytes: String(25 * 1024 ** 3),
            used_bytes: "0",
            reserved_bytes: "0",
            file_count: 0,
            status: "active",
          },
        ],
      };
    }
    if (sql.includes("role_room_reserve_storage")) {
      return { rows: [{ role_room_reserve_storage: true }] };
    }
    return { rows: [], rowCount: 1 };
  });
  return { pool: { query } as never, calls };
}

describe("Production Sound object storage", () => {
  it("creates a checksum-bound private Role Room key scoped to project and day", async () => {
    const state = testPool();
    let signed: PutObjectCommand | null = null;
    const projectId = "10000000-0000-4000-8000-000000000002";
    const dayId = "troll-day-1";

    const ticket = await initiateProductionSoundUpload(
      state.pool,
      {
        userId: "sound-mixer",
        organizationId: "studio-nord",
        projectId,
        productionDayId: dayId,
        fileName: "TROLL_12A_003.WAV",
        sizeBytes: 1024,
        contentType: "audio/wav",
        checksumSha256: "c".repeat(64),
        channel: "browser",
      },
      {
        storage: {
          provider: "aws_s3",
          region: "eu-north-1",
          bucket: "the-role-room-prod-745600963362-eu-north-1",
          client: {} as never,
        },
        signer: async (_client, command) => {
          signed = command as PutObjectCommand;
          return "https://the-role-room-prod-745600963362-eu-north-1.s3.eu-north-1.amazonaws.com/signed";
        },
      },
    );

    expect(ticket).toMatchObject({ strategy: "single" });
    expect(signed).toBeInstanceOf(PutObjectCommand);
    expect(String(signed!.input.Key)).toMatch(
      /^organizations\/studio-nord\/projects\/10000000-0000-4000-8000-000000000002\/production\/sound\/production-days\/troll-day-1\/recorder-files\/uploads\/sound-mixer\/[0-9a-f-]{36}\/original\.wav$/,
    );
    const insert = state.calls.find(({ sql }) =>
      sql.includes("INSERT INTO role_room_storage_objects"),
    );
    expect(insert?.params[7]).toBe("sound-mixer");
    expect(insert?.params[12]).toBe("browser");
    expect(insert?.params[13]).toBe("production-sound");
    expect(insert?.params[14]).toBe(projectId);
    expect(JSON.parse(String(insert?.params[8]))).toMatchObject({
      entityType: "production_sound_day",
      entityId: dayId,
      productionDayId: dayId,
    });
  });

  it("rejects a non-WAVE media type before reserving quota", async () => {
    const state = testPool();
    await expect(
      initiateProductionSoundUpload(
        state.pool,
        {
          userId: "sound-mixer",
          projectId: "10000000-0000-4000-8000-000000000002",
          productionDayId: "troll-day-1",
          fileName: "notes.pdf",
          sizeBytes: 1024,
          contentType: "application/pdf",
          checksumSha256: "c".repeat(64),
          channel: "browser",
        },
        { storage: {} as never },
      ),
    ).rejects.toThrow("unsupported_audio_type");
    expect(
      state.calls.some(({ sql }) => sql.includes("role_room_reserve_storage")),
    ).toBe(false);
  });
});
