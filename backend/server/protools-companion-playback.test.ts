import { Readable } from "node:stream";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  s3Send: vi.fn(),
  commandInputs: [] as Array<Record<string, unknown>>,
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send(command: { input: Record<string, unknown> }) {
      mocks.commandInputs.push(command.input);
      return mocks.s3Send(command);
    }
  },
  GetObjectCommand: class { constructor(public input: Record<string, unknown>) {} },
  PutObjectCommand: class { constructor(public input: Record<string, unknown>) {} },
}));

vi.mock("./protools-companion-persistence.js", () => ({
  ensureProToolsCompanionSchema: vi.fn(async () => undefined),
  enqueueEaseVerseSync: vi.fn(),
  retryEaseVerseSync: vi.fn(),
  claimPairingCode: vi.fn(),
  createPairingCode: vi.fn(),
  databaseRateLimited: vi.fn(),
}));

let setupProToolsCompanionRoutes: typeof import("./protools-companion-routes.js").setupProToolsCompanionRoutes;

const BOUNCE_ID = "00000000-0000-4000-8000-000000000010";
const storageKey = "protools-bounces/user-1/session-1/mix.wav";

function harness(options: { authenticated?: boolean; shared?: boolean; userId?: string } = {}) {
  const query = vi.fn(async (sqlValue: unknown) => {
    const sql = String(sqlValue);
    if (sql.includes("FROM protools_companion_bounces b") && sql.includes("audio_review_members")) {
      return { rows: options.shared ? [{ storage_key: storageKey, file_name: "mix.wav" }] : [], rowCount: options.shared ? 1 : 0 };
    }
    if (sql.includes("FROM protools_companion_bounces b") && sql.includes("protools_companion_sessions")) {
      return { rows: [{ storage_key: storageKey, file_name: "mix.wav", user_id: "user-1", workspace_project_id: "project-1" }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  const app = express();
  app.use(express.json());
  setupProToolsCompanionRoutes({
    app,
    pool: { query },
    requireUserSession: vi.fn((_req, res) => {
      if (options.authenticated === false) { res.status(401).json({ error: "unauthorized" }); return null; }
      return { userId: options.userId || "user-1", email: "producer@example.test", name: "Producer", role: "musicproducer" };
    }),
  });
  return { app, query };
}

describe("Pro Tools bounce playback", () => {
  beforeAll(async () => {
    vi.stubEnv("R2_ENDPOINT", "https://r2.example.test");
    vi.stubEnv("R2_BUCKET", "private-audio");
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret");
    ({ setupProToolsCompanionRoutes } = await import("./protools-companion-routes.js"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.s3Send.mockResolvedValue({
      Body: Readable.from([Buffer.from("RIFFtest")]),
      ContentType: "audio/wav",
      ContentLength: 8,
      ContentRange: "bytes 0-7/8",
      AcceptRanges: "bytes",
      ETag: '"etag"',
    });
  });

  it("streams an owner bounce through same-origin with HTTP byte ranges", async () => {
    const { app } = harness();
    const response = await request(app)
      .get(`/api/protools/bounces/${BOUNCE_ID}/file`)
      .set("Range", "bytes=0-7");

    expect(response.status).toBe(206);
    expect(response.headers["content-type"]).toContain("audio/wav");
    expect(response.headers["accept-ranges"]).toBe("bytes");
    expect(response.headers["content-range"]).toBe("bytes 0-7/8");
    expect(response.headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(mocks.commandInputs.at(-1)).toMatchObject({
      Bucket: "private-audio",
      Key: storageKey,
      Range: "bytes=0-7",
    });
  });

  it("rejects unauthenticated owner playback before reading private storage", async () => {
    const { app, query } = harness({ authenticated: false });
    const response = await request(app).get(`/api/protools/bounces/${BOUNCE_ID}/file`);

    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
    expect(mocks.s3Send).not.toHaveBeenCalled();
  });

  it("does not expose another producer's bounce by ID", async () => {
    const { app } = harness({ userId: "user-2" });
    const response = await request(app).get(`/api/protools/bounces/${BOUNCE_ID}/file`);

    expect(response.status).toBe(404);
    expect(mocks.s3Send).not.toHaveBeenCalled();
  });

  it("allows a current reviewer invite without requiring a user session", async () => {
    const { app } = harness({ authenticated: false, shared: true });
    const response = await request(app)
      .get(`/api/protools/bounces/${BOUNCE_ID}/file`)
      .query({ share: "inv_valid-reviewer" });

    expect(response.status).toBe(206);
    expect(mocks.s3Send).toHaveBeenCalledOnce();
  });

  it("rejects an expired or unrelated reviewer invite", async () => {
    const { app } = harness({ authenticated: false, shared: false });
    const response = await request(app)
      .get(`/api/protools/bounces/${BOUNCE_ID}/file`)
      .query({ share: "inv_expired-reviewer" });

    expect(response.status).toBe(404);
    expect(mocks.s3Send).not.toHaveBeenCalled();
  });
});
