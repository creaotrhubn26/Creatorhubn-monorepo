import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  broadcast: vi.fn(),
  ensureSchema: vi.fn(async () => undefined),
}));

vi.mock("./protools-companion-persistence.js", () => ({
  ensureProToolsCompanionSchema: mocks.ensureSchema,
  enqueueEaseVerseSync: vi.fn(),
  retryEaseVerseSync: vi.fn(),
  claimPairingCode: vi.fn(),
  createPairingCode: vi.fn(),
  databaseRateLimited: vi.fn(),
}));
vi.mock("./sound-room-events.js", () => ({
  broadcastSoundRoomUpdated: mocks.broadcast,
}));
vi.mock("./music-artifact-lineage.js", () => ({
  claimCompanionCommands: vi.fn(),
  latestParentArtifactId: vi.fn(),
  queueCompanionCommand: vi.fn(),
  upsertMusicArtifact: vi.fn(),
  validateCompanionCommand: vi.fn(),
}));

import { setupProToolsCompanionRoutes } from "./protools-companion-routes.js";

const SESSION_ID = "00000000-0000-4000-8000-000000000101";
const ROOM_ID = "00000000-0000-4000-8000-000000000102";
const JOB_ID = "00000000-0000-4000-8000-000000000103";
const BOUNCE_ID = "00000000-0000-4000-8000-000000000104";
const MANIFEST_ID = "00000000-0000-4000-8000-000000000105";

function harness(options: { owned?: boolean; withRoom?: boolean } = {}) {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const withRoom = options.withRoom === true;
  const query = vi.fn(async (sqlValue: unknown, values: unknown[] = []) => {
    const sql = String(sqlValue);
    queries.push({ sql, values });
    if (sql.includes("FROM desktop_device_tokens")) {
      return { rows: [{ id: "device-1", user_id: "user-1", user_email: "producer@example.test" }], rowCount: 1 };
    }
    if (sql.includes("FROM protools_companion_sessions s")) {
      return options.owned === false
        ? { rows: [], rowCount: 0 }
        : { rows: [{ id: SESSION_ID, user_id: "user-1", workspace_project_id: null,
          audio_review_project_id: withRoom ? ROOM_ID : null, sample_rate: 48_000, bit_depth: 24 }], rowCount: 1 };
    }
    if (sql.includes("FROM audio_review_projects ar")) {
      return { rows: [{ id: ROOM_ID, owner_user_id: "user-1", workspace_project_id: null }], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO protools_session_snapshots")) {
      return { rows: [{ id: "snapshot-1", fingerprint: values[3], reason: values[4] }], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO protools_delivery_jobs")) {
      return { rows: [{ id: JOB_ID, status: "running", requested_outputs: JSON.parse(String(values[4])) }], rowCount: 1 };
    }
    if (sql.includes("UPDATE protools_delivery_jobs SET status=")) {
      return { rows: [{ id: JOB_ID, session_id: SESSION_ID, user_id: "user-1", status: values[3],
        audio_review_project_id: withRoom ? ROOM_ID : null, manifest_id: null, preset: "label" }], rowCount: 1 };
    }
    if (sql.includes("SELECT * FROM protools_delivery_jobs") && sql.includes("FOR UPDATE")) {
      return { rows: [{ id: JOB_ID, session_id: SESSION_ID, user_id: "user-1", status: "completed",
        audio_review_project_id: ROOM_ID, manifest_id: null, preset: "label" }], rowCount: 1 };
    }
    if (sql.includes("FROM protools_companion_bounces") && sql.includes("delivery_job_id")) {
      return { rows: [{ count: 1 }], rowCount: 1 };
    }
    if (sql.includes("MAX(manifest_number)")) return { rows: [{ number: 2 }], rowCount: 1 };
    if (sql.includes("INSERT INTO audio_delivery_manifests")) return { rows: [{ id: MANIFEST_ID }], rowCount: 1 };
    if (sql.includes("UPDATE protools_delivery_jobs SET manifest_id")) {
      return { rows: [{ id: JOB_ID, manifest_id: MANIFEST_ID, audio_review_project_id: ROOM_ID }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  setupProToolsCompanionRoutes({
    app,
    pool: { query },
    requireUserSession: vi.fn(() => null),
  });
  return { app, query, queries };
}

const authorized = (operation: any) => operation.set("Authorization", "Bearer device-test-token");

describe("Pro Tools producer suite routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores a normalized, deterministic snapshot for the authenticated session owner", async () => {
    const { app, queries } = harness();
    const response = await authorized(request(app).post(`/api/protools/sessions/${SESSION_ID}/snapshots`)).send({
      reason: "pre_publish",
      snapshot: { sessionName: "Album Mix", sessionPath: "/sessions/album.ptx", sampleRate: "48000", bitDepth: "24",
        tracks: [{ id: "track-1", name: "Lead Vocal" }], playlists: [], routing: [], bounceSources: [], plugins: [] },
    });

    expect(response.status).toBe(201);
    const insert = queries.find((entry) => entry.sql.includes("INSERT INTO protools_session_snapshots"));
    expect(insert?.values[3]).toMatch(/^[a-f0-9]{64}$/);
    expect(insert?.values.slice(4, 10)).toEqual(["pre_publish", "Album Mix", "/sessions/album.ptx", 48_000, 24, 1]);
  });

  it("does not expose producer-suite state from a session owned by another user", async () => {
    const { app } = harness({ owned: false });
    const response = await authorized(request(app).get(`/api/protools/sessions/${SESSION_ID}/snapshots`));
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("session_not_found");
  });

  it("requires an explicit, safe and unique Pro Tools source for each delivery output", async () => {
    const { app } = harness();
    const response = await authorized(request(app).post(`/api/protools/sessions/${SESSION_ID}/delivery-jobs`)).send({
      preset: "label",
      outputs: [{ kind: "instrumental", fileName: "../Master.wav", source: "" }],
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_delivery_output");
  });

  it("refuses to publish a delivery manifest without passed QC and owned bounce URLs", async () => {
    const { app, query } = harness({ withRoom: true });
    const response = await authorized(request(app).patch(`/api/protools/sessions/${SESSION_ID}/delivery-jobs/${JOB_ID}`)).send({
      status: "completed",
      progress: 100,
      outputFiles: [{ bounceId: BOUNCE_ID, fileName: "Master.wav", fileUrl: "https://attacker.example/file.wav",
        format: "wav", sizeBytes: 100, checksum: "a".repeat(64) }],
      qcReports: [{ passed: true }],
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_delivery_result");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE protools_delivery_jobs SET status="))).toBe(false);
  });

  it("creates one Sound Room manifest after validating passed QC and bounce ownership", async () => {
    const { app, queries } = harness({ withRoom: true });
    const response = await authorized(request(app).patch(`/api/protools/sessions/${SESSION_ID}/delivery-jobs/${JOB_ID}`)).send({
      status: "completed",
      progress: 100,
      outputFiles: [{ bounceId: BOUNCE_ID, artifactId: "artifact-1", fileName: "Master.wav",
        fileUrl: `/api/protools/bounces/${BOUNCE_ID}/file`, format: "wav", sizeBytes: 4096, checksum: "b".repeat(64) }],
      qcReports: [{ passed: true, truePeakDbtp: -1.1 }],
    });
    expect(response.status).toBe(200);
    expect(response.body.job.manifest_id).toBe(MANIFEST_ID);
    expect(queries.some((entry) => entry.sql.includes("INSERT INTO audio_delivery_manifest_items"))).toBe(true);
    expect(queries.find((entry) => entry.sql.includes("delivery_job_id=$1"))?.values).toEqual([JOB_ID, SESSION_ID, [BOUNCE_ID]]);
  });
});
