import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(),
  getCreatorHubObject: vi.fn(),
  presignCreatorHubObjectDownload: vi.fn(),
}));

vi.mock("./protools-companion-persistence.js", async () => {
  const actual = await vi.importActual<typeof import("./protools-companion-persistence.js")>("./protools-companion-persistence.js");
  return { ...actual, ensureProToolsCompanionSchema: vi.fn(async () => undefined), enqueueEaseVerseSync: mocks.enqueue };
});

vi.mock("./creatorhub-object-storage.js", () => ({
  getCreatorHubObject: mocks.getCreatorHubObject,
  presignCreatorHubObjectDownload: mocks.presignCreatorHubObjectDownload,
}));

import { setupProToolsCompanionRoutes } from "./protools-companion-routes.js";
import { resetProToolsCompanionReleaseCacheForTests } from "./protools-companion-release-service.js";

function companionReleaseManifest() {
  const version = "0.3.1";
  const prefix = `platform/releases/protools-companion/${version}`;
  const artifact = (id: string, filename: string, extra: Record<string, unknown> = {}) => ({
    id,
    filename,
    key: `${prefix}/${filename}`,
    sizeBytes: 1_048_576,
    sha256: "a".repeat(64),
    ...extra,
  });
  return {
    schemaVersion: 1,
    product: "protools-companion",
    version,
    publishedAt: "2026-09-14T10:00:00Z",
    notes: "CreatorHub Pro Tools Companion 0.3.1",
    downloads: [
      artifact("mac-arm-dmg", `CreatorHub-ProTools-Companion_${version}_aarch64_signed-notarized.dmg`, { os: "macOS", arch: "Apple Silicon", format: "DMG", signed: true }),
      artifact("mac-intel-dmg", `CreatorHub-ProTools-Companion_${version}_x64_signed-notarized.dmg`, { os: "macOS", arch: "Intel", format: "DMG", signed: true }),
      artifact("windows-exe", `CreatorHub-ProTools-Companion_${version}_x64_signed.exe`, { os: "Windows", arch: "x64", format: "EXE", signed: true }),
      artifact("windows-msi", `CreatorHub-ProTools-Companion_${version}_x64_signed.msi`, { os: "Windows", arch: "x64", format: "MSI", signed: true }),
    ],
    updater: {
      "darwin-aarch64": artifact("updater-darwin-arm", `CreatorHub-ProTools-Companion_${version}_aarch64.app.tar.gz`, { signature: "trusted-signature-arm" }),
      "darwin-x86_64": artifact("updater-darwin-intel", `CreatorHub-ProTools-Companion_${version}_x64.app.tar.gz`, { signature: "trusted-signature-intel" }),
      "windows-x86_64": artifact("updater-windows-x64", `CreatorHub-ProTools-Companion_${version}_x64-setup.exe.zip`, { signature: "trusted-signature-windows" }),
    },
  };
}

function createPool() {
  const query = vi.fn(async (sqlValue: unknown) => {
    const sql = String(sqlValue);
    if (sql.includes("FROM desktop_device_tokens WHERE token_hash")) {
      return { rows: [{ id: "device-1", user_id: "user-1", user_email: "producer@example.test" }], rowCount: 1 };
    }
    if (sql.includes("SELECT s.*, COALESCE(ar.external_track_id")) {
      return {
        rows: [{
          id: "session-1",
          user_id: "user-1",
          easeverse_track_id: "track-local-1",
          easeverse_external_track_id: "track-external-1",
          audio_review_project_id: "review-1",
          tempo: 124,
        }],
        rowCount: 1,
      };
    }
    if (sql.includes("FROM audio_review_projects ar") && sql.includes("project_audio_rooms")) {
      return { rows: [{ id: "review-1", owner_user_id: "user-1", easeverse_track_id: "track-local-1", workspace_project_id: null }], rowCount: 1 };
    }
    if (sql.includes("SELECT id FROM audio_review_versions")) {
      return { rows: [{ id: "version-1" }], rowCount: 1 };
    }
    if (sql.includes("FROM protools_companion_markers") && sql.includes("order_index")) {
      return {
        rows: [{ name: "Chorus", start_seconds: 32, end_seconds: 48, color: null, order_index: 0 }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  });
  return { query };
}

describe("Pro Tools Companion EaseVerse bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetProToolsCompanionReleaseCacheForTests();
    mocks.enqueue.mockResolvedValue({ configured: true, synced: true, status: 200, storage: "postgres", eventId: "file-1:markers", revision: 1, queued: false });
    mocks.getCreatorHubObject.mockResolvedValue({
      body: Buffer.from(JSON.stringify(companionReleaseManifest())),
    });
    mocks.presignCreatorHubObjectDownload.mockResolvedValue("https://creatorhubn-prod.s3.eu-north-1.amazonaws.com/signed");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports only CreatorHub S3-backed notarized and Authenticode-signed installers", async () => {
    const app = express();
    setupProToolsCompanionRoutes({
      app,
      pool: createPool(),
      requireUserSession: vi.fn(() => null),
    });

    const response = await request(app).get("/api/protools/companion/release");

    expect(response.status).toBe(200);
    expect(response.body.version).toBe("0.3.1");
    expect(response.body.source).toBe("creatorhub-s3");
    expect(response.body.downloads).toEqual(expect.arrayContaining([
      expect.objectContaining({ os: "macOS", arch: "Apple Silicon", format: "DMG", signed: true, url: "/api/protools/companion/download/0.3.1/mac-arm-dmg" }),
      expect.objectContaining({ os: "macOS", arch: "Intel", format: "DMG", signed: true }),
      expect.objectContaining({ os: "Windows", arch: "x64", format: "MSI", signed: true }),
      expect.objectContaining({ os: "Windows", arch: "x64", format: "EXE", signed: true }),
    ]));
    expect(JSON.stringify(response.body)).not.toContain("github.com");
  });

  it("redirects only allowlisted manifest artifacts to a short S3 URL", async () => {
    const app = express();
    setupProToolsCompanionRoutes({ app, pool: createPool(), requireUserSession: vi.fn(() => null) });

    const download = await request(app).get("/api/protools/companion/download/0.3.1/windows-exe");
    expect(download.status).toBe(302);
    expect(download.headers.location).toContain("creatorhubn-prod.s3.eu-north-1.amazonaws.com");
    expect(mocks.presignCreatorHubObjectDownload).toHaveBeenCalledWith(
      "platform/releases/protools-companion/0.3.1/CreatorHub-ProTools-Companion_0.3.1_x64_signed.exe",
      "CreatorHub-ProTools-Companion_0.3.1_x64_signed.exe",
      300,
    );

    const rejected = await request(app).get("/api/protools/companion/download/0.3.1/organizations-secret");
    expect(rejected.status).toBe(404);
    expect(mocks.presignCreatorHubObjectDownload).toHaveBeenCalledTimes(1);
  });

  it("serves a Tauri updater manifest whose packages are delivered by CreatorHub", async () => {
    const app = express();
    setupProToolsCompanionRoutes({ app, pool: createPool(), requireUserSession: vi.fn(() => null) });

    const response = await request(app).get("/api/protools/companion/updater/latest");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      version: "0.3.1",
      platforms: {
        "darwin-aarch64": {
          signature: "trusted-signature-arm",
          url: "https://www.creatorhubn.com/api/protools/companion/download/0.3.1/updater-darwin-arm",
        },
        "windows-x86_64": {
          url: "https://www.creatorhubn.com/api/protools/companion/download/0.3.1/updater-windows-x64",
        },
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("github.com");
  });

  it("stores markers in Sound Room and mirrors the same snapshot to EaseVerse", async () => {
    const pool = createPool();
    const app = express();
    app.use(express.json());
    setupProToolsCompanionRoutes({
      app,
      pool,
      requireUserSession: vi.fn(() => null),
    });

    const response = await request(app)
      .post("/api/protools/sessions/session-1/markers")
      .set("authorization", "Bearer trr_desk_test")
      .send({ eventId: "file-1", markers: [{ id: "chorus", name: "Chorus", startSeconds: 32, endSeconds: 48 }] });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      markersStored: 1,
      sectionsSynced: 1,
      easeverseSync: { configured: true, synced: true, status: 200, storage: "postgres" },
    });
    expect(mocks.enqueue).toHaveBeenCalledWith({
      pool,
      sessionId: "session-1",
      userId: "user-1",
      eventType: "markers",
      eventId: "file-1:markers",
      payload: {
        externalTrackId: "track-external-1",
        audioReviewProjectId: "review-1",
        bpm: 124,
        markers: [{ id: "chorus", name: "Chorus", startSeconds: 32, endSeconds: 48 }],
      },
    });
  });

  it("accepts missing Pro Tools tempo as null metadata instead of 0 BPM", async () => {
    const pool = createPool();
    const app = express();
    app.use(express.json());
    setupProToolsCompanionRoutes({
      app,
      pool,
      requireUserSession: vi.fn(() => null),
    });

    const response = await request(app)
      .post("/api/protools/sessions/session-1/metadata")
      .set("authorization", "Bearer trr_desk_test")
      .send({
        eventId: "session-info-1",
        tempo: null,
        keySignature: null,
        timeSignature: null,
        sampleRate: 48000,
        bitDepth: 32,
        tracks: [{ name: "CreatorHub-E2E-source", type: "audio" }],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    const sessionUpdate = pool.query.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE protools_companion_sessions SET"),
    );
    expect(sessionUpdate?.[1]?.[1]).toBeNull();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("returns a device-scoped Sound Room feedback inbox", async () => {
    const app = express();
    app.use(express.json());
    setupProToolsCompanionRoutes({ app, pool: createPool(), requireUserSession: vi.fn(() => null) });
    const response = await request(app)
      .get("/api/protools/sessions/session-1/feedback")
      .set("authorization", "Bearer trr_desk_test");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ comments: [], approvals: [], tasks: [] });
    expect(response.body.generatedAt).toEqual(expect.any(String));
  });
});
