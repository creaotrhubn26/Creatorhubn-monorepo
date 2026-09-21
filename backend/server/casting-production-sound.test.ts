import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createCastingProductionRouter } from "./casting-production-routes.js";
import {
  normalizeProductionSoundOperations,
  ProductionSoundValidationError,
} from "./casting-production-sound.js";

const SESSION_TOKEN = "sound-session";
const PROJECT_ID = "troll";
const DAY_ID = "day-1";
const PATH = `/api/role-room/projects/${PROJECT_ID}/production-days/${DAY_ID}/production-sound`;

const operations = () => ({
  dayStatus: "recording",
  setup: {
    recorder: "833",
    soundRoll: "A001",
    sampleRate: 48000,
    bitDepth: 24,
    frameRate: "25",
    timecodeMode: "external",
  },
  tracks: [
    {
      id: "track-boom",
      trackName: "Boom 1",
      sourceType: "boom",
      status: "active",
    },
  ],
  takeReports: [
    {
      id: "report-1",
      continuityTakeId: "take-1",
      fileName: "A001_001T01.wav",
      trackIds: ["track-boom"],
      quality: "clean",
      issueTags: [],
      needsAdr: false,
    },
  ],
  unmatchedRecordings: [],
  additionalRecordings: [
    {
      id: "room-1",
      type: "room_tone",
      sceneId: "scene-1",
      name: "Room tone",
      status: "recorded",
    },
  ],
  handoff: { status: "draft" },
});

function dayRow(version = 0, soundOperations?: Record<string, unknown>) {
  return {
    id: DAY_ID,
    project_id: PROJECT_ID,
    date: "2026-09-21",
    scene_ids: ["scene-1"],
    crew_ids: [],
    prop_ids: [],
    sound_version: version,
    sound_updated_by: version ? "mixer-2" : null,
    data: {
      productionContinuity: {
        takes: [{ id: "take-1", sceneId: "scene-1", takeNumber: 1 }],
      },
      ...(soundOperations ? { productionSound: soundOperations } : {}),
    },
  };
}

function accessResult(role: string | null) {
  return {
    rows: [
      {
        project_exists: true,
        is_owner: false,
        member_role: role,
        member_permissions: null,
        member_additional_roles: null,
      },
    ],
    rowCount: 1,
  };
}

function appFor(query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/role-room",
    createCastingProductionRouter({ query } as unknown as Pool, {
      activeSessions: new Map([
        [
          SESSION_TOKEN,
          {
            userId: "mixer-1",
            email: "sound@example.test",
            name: "Mixer",
            role: "production_sound_mixer",
            loginAt: new Date().toISOString(),
          },
        ],
      ]),
    }),
  );
  return app;
}

function schemaResult(text: string) {
  return /ALTER TABLE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX/.test(text)
    ? { rows: [], rowCount: 0 }
    : null;
}

describe("production sound normalization", () => {
  it("accepts recorder metadata while excluding forged activity", () => {
    const normalized = normalizeProductionSoundOperations({
      ...operations(),
      activity: [{ id: "forged" }],
    });
    expect(normalized.takeReports[0].continuityTakeId).toBe("take-1");
    expect(normalized).not.toHaveProperty("activity");
  });

  it("rejects reports that reference an unknown local track", () => {
    const value = operations();
    value.takeReports[0].trackIds = ["missing"];
    expect(() => normalizeProductionSoundOperations(value)).toThrow(
      ProductionSoundValidationError,
    );
  });
});

describe("Production Sound API", () => {
  it("saves against canonical take IDs and creates the audit event server-side", async () => {
    let written: Record<string, unknown> | null = null;
    const query = vi.fn(async (text: string, params?: unknown[]) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes("AS member_role"))
        return accessResult("production_sound_mixer");
      if (text.startsWith("SELECT * FROM casting_production_days"))
        return { rows: [dayRow()], rowCount: 1 };
      if (text.includes("UPDATE casting_production_days")) {
        written = JSON.parse(String(params?.[3]));
        return {
          rows: [{ ...dayRow(1, written), sound_updated_by: "mixer-1" }],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(appFor(query))
      .patch(PATH)
      .set("Authorization", `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 0,
        operations: {
          ...operations(),
          activity: [
            { id: "forged", type: "workspace_saved", message: "fake" },
          ],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.productionDay).toEqual(
      expect.objectContaining({ soundVersion: 1, soundUpdatedBy: "mixer-1" }),
    );
    expect(response.body.productionDay.productionSound.activity).toEqual([
      expect.objectContaining({
        actorUserId: "mixer-1",
        type: "workspace_saved",
      }),
    ]);
    expect(response.body.productionDay.productionSound.activity[0].id).not.toBe(
      "forged",
    );
  });

  it("returns a uniform conflict without overwriting the local request", async () => {
    const latest = operations();
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes("AS member_role")) return accessResult("boom_operator");
      if (text.startsWith("SELECT * FROM casting_production_days"))
        return { rows: [dayRow(3, latest)], rowCount: 1 };
      throw new Error(`Unexpected SQL: ${text}`);
    });
    const response = await request(appFor(query))
      .patch(PATH)
      .set("Authorization", `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 2, operations: operations() });
    expect(response.status).toBe(409);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "version_conflict",
        conflict: expect.objectContaining({
          lane: "production_sound",
          currentVersion: 3,
          updatedBy: "mixer-2",
        }),
        productionDay: expect.objectContaining({ soundVersion: 3 }),
      }),
    );
  });

  it("rejects a take reference that continuity does not own", async () => {
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes("AS member_role"))
        return accessResult("production_sound_mixer");
      if (text.startsWith("SELECT * FROM casting_production_days"))
        return { rows: [dayRow()], rowCount: 1 };
      throw new Error(`Unexpected SQL: ${text}`);
    });
    const invalid = operations();
    invalid.takeReports[0].continuityTakeId = "invented-take";
    const response = await request(appFor(query))
      .patch(PATH)
      .set("Authorization", `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 0, operations: invalid });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("take_reference_conflict");
  });

  it("fails closed for a project member without the sound grant", async () => {
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes("AS member_role")) return accessResult("viewer");
      throw new Error(`Unexpected SQL: ${text}`);
    });
    const response = await request(appFor(query))
      .patch(PATH)
      .set("Authorization", `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 0, operations: operations() });
    expect(response.status).toBe(404);
  });
});
