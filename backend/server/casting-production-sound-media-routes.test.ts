import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import {
  createCastingProductionRouter,
  type CreateCastingProductionRouterDeps,
} from "./casting-production-routes.js";

const SESSION_TOKEN = "production-sound-session";
const PROJECT_ID = "project-1";
const MEDIA_ID = "8b49da36-ff43-4d8f-98dc-20ce0e39218d";
const OBJECT_ID = "9281527f-d802-4624-9cf2-3005ef7f6433";
const BASE_PATH = `/api/role-room/projects/${PROJECT_ID}/production-days/day-1/production-sound/media`;

function createApp(
  pool: Pool,
  overrides: Omit<CreateCastingProductionRouterDeps, "activeSessions"> = {},
) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/role-room",
    createCastingProductionRouter(pool, {
      activeSessions: new Map([
        [
          SESSION_TOKEN,
          {
            userId: "sound-mixer-1",
            email: "sound@example.test",
            name: "Sound Mixer",
            role: "production_sound_mixer",
            loginAt: new Date().toISOString(),
          },
        ],
      ]),
      ...overrides,
    }),
  );
  return app;
}

function accessPool(extra?: (text: string, values?: unknown[]) => unknown) {
  const query = vi.fn(async (text: string, values?: unknown[]) => {
    if (
      /ALTER TABLE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX/.test(text)
    ) {
      return { rows: [], rowCount: 0 };
    }
    if (text.includes("AS member_role")) {
      return {
        rows: [
          {
            project_exists: true,
            is_owner: true,
            member_role: null,
            member_permissions: null,
          },
        ],
        rowCount: 1,
      };
    }
    const result = extra?.(text, values);
    if (result) return result;
    throw new Error(`Unexpected SQL: ${text}`);
  });
  return { pool: { query } as unknown as Pool, query };
}

const recorderMetadata = {
  container: "RIFF" as const,
  audioFormat: 1,
  channels: 2,
  sampleRate: 48_000,
  byteRate: 288_000,
  blockAlign: 6,
  bitDepth: 24,
  dataSizeBytes: 2_880,
  durationSeconds: 0.01,
  ixml: { scene: "12A", take: "3", tracks: [] },
  warnings: [],
};

function media(continuityTakeId: string | null = null) {
  return {
    id: MEDIA_ID,
    projectId: PROJECT_ID,
    productionDayId: "day-1",
    storageObjectId: OBJECT_ID,
    uploadedBy: "sound-mixer-1",
    displayName: "TROLL_12A_003.wav",
    contentType: "audio/wav",
    sizeBytes: 24_000,
    checksumSha256: "a".repeat(64),
    recorderMetadata,
    reconciliationStatus: continuityTakeId
      ? ("matched" as const)
      : ("unmatched" as const),
    continuityTakeId: continuityTakeId ?? undefined,
    createdAt: "2026-09-21T08:00:00.000Z",
  };
}

describe("production sound recorder media routes", () => {
  it("initiates direct S3 upload only after grant and production-day checks", async () => {
    const state = accessPool((text) =>
      text.startsWith("SELECT 1 FROM casting_production_days")
        ? { rows: [{ exists: 1 }], rowCount: 1 }
        : undefined,
    );
    const initiateProductionSoundMediaUpload = vi.fn(async () => ({
      objectId: OBJECT_ID,
      strategy: "multipart" as const,
      uploadId: "upload-1",
      partSize: 16 * 1024 * 1024,
      partCount: 2,
      expiresInSeconds: 3600,
    }));

    const response = await request(
      createApp(state.pool, { initiateProductionSoundMediaUpload }),
    )
      .post(`${BASE_PATH}/initiate`)
      .set("authorization", `Bearer ${SESSION_TOKEN}`)
      .send({
        fileName: "TROLL_12A_003.wav",
        sizeBytes: 24_000,
        contentType: "audio/wav",
        checksumSha256: "a".repeat(64),
      });

    expect(response.status).toBe(201);
    expect(response.body.upload).toEqual(
      expect.objectContaining({ objectId: OBJECT_ID, strategy: "multipart" }),
    );
    expect(initiateProductionSoundMediaUpload).toHaveBeenCalledWith(
      expect.anything(),
      {
        userId: "sound-mixer-1",
        projectId: PROJECT_ID,
        productionDayId: "day-1",
        fileName: "TROLL_12A_003.wav",
        sizeBytes: 24_000,
        contentType: "audio/wav",
        checksumSha256: "a".repeat(64),
      },
    );
  });

  it("lists parsed metadata without exposing a storage object key", async () => {
    const state = accessPool((text) =>
      text.startsWith("SELECT 1 FROM casting_production_days")
        ? { rows: [{ exists: 1 }], rowCount: 1 }
        : undefined,
    );
    const listProductionSoundMedia = vi.fn(async () => [media()]);

    const response = await request(
      createApp(state.pool, { listProductionSoundMedia }),
    )
      .get(BASE_PATH)
      .set("authorization", `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body.media).toEqual([
      expect.objectContaining({
        id: MEDIA_ID,
        reconciliationStatus: "unmatched",
        recorderMetadata: expect.objectContaining({
          ixml: expect.objectContaining({ scene: "12A", take: "3" }),
        }),
      }),
    ]);
    expect(JSON.stringify(response.body)).not.toContain("objectKey");
  });

  it("permanently deletes an unmatched recorder file through the scoped service", async () => {
    const state = accessPool();
    const deleteProductionSoundMedia = vi.fn(async () => true);

    const response = await request(
      createApp(state.pool, { deleteProductionSoundMedia }),
    )
      .delete(`${BASE_PATH}/${MEDIA_ID}`)
      .set("authorization", `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(204);
    expect(deleteProductionSoundMedia).toHaveBeenCalledWith(expect.anything(), {
      mediaId: MEDIA_ID,
      projectId: PROJECT_ID,
      productionDayId: "day-1",
    });
  });

  it("requires an explicit unlink before a reconciled recorder file is deleted", async () => {
    const state = accessPool();
    const deleteProductionSoundMedia = vi.fn(async () => {
      throw new Error("media_reconciled");
    });

    const response = await request(
      createApp(state.pool, { deleteProductionSoundMedia }),
    )
      .delete(`${BASE_PATH}/${MEDIA_ID}`)
      .set("authorization", `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "media_reconciled",
      message: "Fjern koblingen til continuity-taken før recorderfilen slettes.",
    });
  });

  it("aborts only the current user's scoped unfinished upload", async () => {
    const state = accessPool();
    const abortProductionSoundMediaUpload = vi.fn(async () => true);

    const response = await request(
      createApp(state.pool, { abortProductionSoundMediaUpload }),
    )
      .delete(`${BASE_PATH}/uploads/${OBJECT_ID}`)
      .set("authorization", `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(204);
    expect(abortProductionSoundMediaUpload).toHaveBeenCalledWith(
      expect.anything(),
      {
        objectId: OBJECT_ID,
        userId: "sound-mixer-1",
        projectId: PROJECT_ID,
        productionDayId: "day-1",
      },
    );
  });

  it("does not call a storage action for forged non-UUID media ids", async () => {
    const state = accessPool();
    const deleteProductionSoundMedia = vi.fn(async () => true);

    const response = await request(
      createApp(state.pool, { deleteProductionSoundMedia }),
    )
      .delete(`${BASE_PATH}/not-a-uuid`)
      .set("authorization", `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(404);
    expect(deleteProductionSoundMedia).not.toHaveBeenCalled();
  });

  it("atomically reconciles one recorder file to a canonical continuity take", async () => {
    const dayData = {
      productionContinuity: {
        sceneRecords: [],
        takes: [
          {
            id: "take-1",
            sceneId: "scene-1",
            takeNumber: 3,
            status: "good",
            circled: true,
          },
        ],
        entries: [],
        deviations: [],
      },
      productionSound: {
        dayStatus: "recording",
        setup: {
          sampleRate: 48_000,
          bitDepth: 24,
          timecodeMode: "free_run",
        },
        tracks: [],
        takeReports: [],
        unmatchedRecordings: [],
        additionalRecordings: [],
        handoff: { status: "draft" },
        activity: [],
      },
    };
    const row = {
      id: MEDIA_ID,
      project_id: PROJECT_ID,
      production_day_id: "day-1",
      storage_object_id: OBJECT_ID,
      uploaded_by: "sound-mixer-1",
      display_name: "TROLL_12A_003.wav",
      content_type: "audio/wav",
      size_bytes: "24000",
      checksum_sha256: "a".repeat(64),
      recorder_metadata: recorderMetadata,
      reconciliation_status: "unmatched",
      continuity_take_id: null,
      reconciled_by: null,
      reconciled_at: null,
      created_at: "2026-09-21T08:00:00.000Z",
    };
    const clientQuery = vi.fn(async (text: string, values?: unknown[]) => {
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(text)) {
        return { rows: [], rowCount: 0 };
      }
      if (text.startsWith("SELECT * FROM casting_production_days")) {
        return {
          rows: [
            {
              id: "day-1",
              project_id: PROJECT_ID,
              date: "2026-09-21",
              scene_ids: ["scene-1"],
              sound_version: 0,
              data: dayData,
            },
          ],
          rowCount: 1,
        };
      }
      if (
        text.includes("FROM casting_production_sound_media") &&
        text.includes("FOR UPDATE")
      ) {
        return { rows: [row], rowCount: 1 };
      }
      if (text.startsWith("UPDATE casting_production_sound_media")) {
        return {
          rows: [
            {
              ...row,
              reconciliation_status: "matched",
              continuity_take_id: "take-1",
              reconciled_by: "sound-mixer-1",
              reconciled_at: String(values?.[6]),
            },
          ],
          rowCount: 1,
        };
      }
      if (text.startsWith("UPDATE casting_production_days")) {
        const productionSound = JSON.parse(String(values?.[3]));
        expect(productionSound.takeReports).toEqual([
          expect.objectContaining({
            continuityTakeId: "take-1",
            recordingFileIds: [MEDIA_ID],
          }),
        ]);
        return {
          rows: [
            {
              id: "day-1",
              project_id: PROJECT_ID,
              date: "2026-09-21",
              scene_ids: ["scene-1"],
              sound_version: 1,
              sound_updated_by: "sound-mixer-1",
              data: { ...dayData, productionSound },
            },
          ],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected transaction SQL: ${text}`);
    });
    const poolQuery = vi.fn(async (text: string) => {
      if (
        /ALTER TABLE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX/.test(text)
      ) {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes("AS member_role")) {
        return {
          rows: [
            {
              project_exists: true,
              is_owner: true,
              member_role: null,
              member_permissions: null,
            },
          ],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected pool SQL: ${text}`);
    });
    const client = { query: clientQuery, release: vi.fn() };
    const pool = {
      query: poolQuery,
      connect: vi.fn(async () => client),
    } as unknown as Pool;

    const response = await request(createApp(pool))
      .patch(`${BASE_PATH}/${MEDIA_ID}/reconcile`)
      .set("authorization", `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 0, continuityTakeId: "take-1" });

    expect(response.status).toBe(200);
    expect(response.body.media).toEqual(
      expect.objectContaining({
        id: MEDIA_ID,
        reconciliationStatus: "matched",
        continuityTakeId: "take-1",
      }),
    );
    expect(response.body.productionDay).toEqual(
      expect.objectContaining({ soundVersion: 1 }),
    );
    expect(clientQuery.mock.calls.map(([sql]) => sql)).toContain("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rejects a forged recorder link through the generic sound save", async () => {
    const state = accessPool((text) => {
      if (text.startsWith("SELECT * FROM casting_production_days")) {
        return {
          rows: [
            {
              id: "day-1",
              project_id: PROJECT_ID,
              date: "2026-09-21",
              scene_ids: ["scene-1"],
              sound_version: 0,
              data: {
                productionContinuity: {
                  takes: [{ id: "take-1", sceneId: "scene-1" }],
                },
                productionSound: {
                  dayStatus: "recording",
                  setup: {
                    sampleRate: 48_000,
                    bitDepth: 24,
                    timecodeMode: "free_run",
                  },
                  tracks: [],
                  takeReports: [],
                  unmatchedRecordings: [],
                  additionalRecordings: [],
                  handoff: { status: "draft" },
                },
              },
            },
          ],
          rowCount: 1,
        };
      }
      return undefined;
    });

    const response = await request(createApp(state.pool))
      .patch(
        `/api/role-room/projects/${PROJECT_ID}/production-days/day-1/production-sound`,
      )
      .set("authorization", `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 0,
        operations: {
          dayStatus: "recording",
          setup: {
            sampleRate: 48_000,
            bitDepth: 24,
            timecodeMode: "free_run",
          },
          tracks: [],
          takeReports: [
            {
              id: "report-1",
              continuityTakeId: "take-1",
              recordingFileIds: [MEDIA_ID],
              trackIds: [],
              quality: "usable",
              issueTags: [],
              needsAdr: false,
            },
          ],
          unmatchedRecordings: [],
          additionalRecordings: [],
          handoff: { status: "draft" },
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/eksplisitte avstemmingshandlingen/);
    expect(
      state.query.mock.calls.some(([sql]) =>
        String(sql).startsWith("UPDATE casting_production_days"),
      ),
    ).toBe(false);
  });
});
