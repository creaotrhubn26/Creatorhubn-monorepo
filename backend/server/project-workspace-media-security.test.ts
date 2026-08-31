import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const b2 = vi.hoisted(() => ({
  archive: vi.fn(),
  head: vi.fn(),
  presignDownload: vi.fn(),
  presignUpload: vi.fn(),
}));

vi.mock("./b2-archive-helper", async () => {
  const actual = await vi.importActual<typeof import("./b2-archive-helper")>("./b2-archive-helper");
  return {
    ...actual,
    archiveToRoleRoomB2: b2.archive,
    headRoleRoomB2Object: b2.head,
    presignRoleRoomB2Download: b2.presignDownload,
    presignRoleRoomB2Upload: b2.presignUpload,
  };
});

import { setupProjectWorkspaceRoutes } from "./project-workspace-routes.js";

type VideoRow = {
  id: string;
  version_label?: string;
  version_number: number;
  file_url?: string | null;
  b2_key?: string | null;
  storage_version_id?: string | null;
  stream_uid?: string | null;
  thumbnail_url?: string | null;
  duration?: number | null;
  chapters?: unknown[];
  status: string;
  content_type?: string | null;
  size_bytes?: number | string | null;
};

function createApp(options: {
  versions?: Record<string, VideoRow[]>;
  videoUploadMaxBytes?: number;
  videoUploadMaxConcurrent?: number;
  videoDirectUploadMaxBytes?: number;
  failDirectUploadPromotion?: boolean;
  sharedVersions?: Map<string, VideoRow>;
  sharedQueries?: Array<{ sql: string; params: unknown[] }>;
  sharedRowLockTails?: Map<string, Promise<void>>;
} = {}) {
  const queries = options.sharedQueries ?? [];
  const versions = options.sharedVersions ?? new Map<string, VideoRow>();
  const comments = new Map<string, Record<string, unknown>>();
  for (const [projectId, rows] of Object.entries(options.versions || {})) {
    for (const row of rows) versions.set(`${projectId}:${row.id}`, { ...row });
  }

  const executeQuery = vi.fn(async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params });
    if (sql.includes("SELECT 1 WHERE EXISTS")) {
      return { rows: [{ ok: 1 }], rowCount: 1 };
    }
    if (sql.includes("SELECT COALESCE(MAX(version_number),0)+1 AS n")) {
      const projectId = String(params[0]);
      const currentMax = [...versions.entries()]
        .filter(([key]) => key.startsWith(`${projectId}:`))
        .reduce((max, [, row]) => Math.max(max, Number(row.version_number) || 0), 0);
      return { rows: [{ n: currentMax + 1 }], rowCount: 1 };
    }
    if (sql.includes("FROM project_video_versions v") && sql.includes("comment_count")) {
      const projectId = String(params[0]);
      return {
        rows: [...versions.entries()]
          .filter(([key, row]) => key.startsWith(`${projectId}:`) && row.status !== "upload_pending")
          .map(([, row]) => ({ ...row, comment_count: 0, open_count: 0 })),
        rowCount: versions.size,
      };
    }
    if (sql.includes("SELECT id, version_number, b2_key, content_type, size_bytes")) {
      const row = versions.get(`${String(params[1])}:${String(params[0])}`);
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }
    if (sql.includes("FROM project_video_versions") && sql.includes("FOR UPDATE")) {
      const row = versions.get(`${String(params[1])}:${String(params[0])}`);
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }
    if (sql.includes("SET status='superseded'") && sql.includes("status='under_review'")) {
      const projectId = String(params[0]);
      const excludedId = params[1] == null ? null : String(params[1]);
      let rowCount = 0;
      for (const [key, row] of versions) {
        if (key.startsWith(`${projectId}:`)
          && row.status === "under_review"
          && row.id !== excludedId) {
          row.status = "superseded";
          rowCount += 1;
        }
      }
      return { rows: [], rowCount };
    }
    if (sql.includes("INSERT INTO project_video_versions") && sql.includes("content_type")) {
      const [id, projectId, versionLabel, versionNumber, key, contentType, sizeBytes] = params;
      versions.set(`${String(projectId)}:${String(id)}`, {
        id: String(id),
        version_label: String(versionLabel),
        version_number: Number(versionNumber),
        b2_key: String(key),
        content_type: String(contentType),
        size_bytes: Number(sizeBytes),
        status: "upload_pending",
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO project_video_versions")
      && sql.includes("file_url, b2_key, stream_uid")) {
      const [
        id,
        projectId,
        versionLabel,
        versionNumber,
        fileUrl,
        ,
        streamUid,
        thumbnailUrl,
        duration,
        chapters,
      ] = params;
      versions.set(`${String(projectId)}:${String(id)}`, {
        id: String(id),
        version_label: String(versionLabel),
        version_number: Number(versionNumber),
        file_url: fileUrl == null ? null : String(fileUrl),
        stream_uid: streamUid == null ? null : String(streamUid),
        thumbnail_url: thumbnailUrl == null ? null : String(thumbnailUrl),
        duration: duration == null ? null : Number(duration),
        chapters: chapters ? JSON.parse(String(chapters)) : [],
        status: "under_review",
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO project_video_versions")
      && sql.includes("b2_key, storage_version_id, status")) {
      const [id, projectId, versionLabel, versionNumber, b2Key, storageVersionId] = params;
      versions.set(`${String(projectId)}:${String(id)}`, {
        id: String(id),
        version_label: String(versionLabel),
        version_number: Number(versionNumber),
        b2_key: String(b2Key),
        storage_version_id: storageVersionId == null ? null : String(storageVersionId),
        status: "under_review",
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("SET status='under_review', upload_expires_at=NULL, storage_version_id=$3")) {
      if (options.failDirectUploadPromotion) throw new Error("promotion_failed");
      const key = `${String(params[1])}:${String(params[0])}`;
      const row = versions.get(key);
      if (!row || row.status !== "upload_pending") return { rows: [], rowCount: 0 };
      row.status = "under_review";
      row.storage_version_id = String(params[2]);
      return {
        rows: [{ id: row.id, version_number: row.version_number, status: row.status }],
        rowCount: 1,
      };
    }
    if (sql.includes("INSERT INTO project_video_comments") && sql.includes("FROM project_video_versions v")) {
      const [
        id,
        versionId,
        projectId,
        timecodeSec,
        endTimecodeSec,
        comment,
        authorName,
        authorKind,
        category,
        isDecision,
        parentId,
      ] = params;
      const version = versions.get(`${String(projectId)}:${String(versionId)}`);
      const parent = parentId == null ? null : comments.get(String(parentId));
      if (!version
        || version.status === "upload_pending"
        || (parentId != null && (
          !parent
          || parent.project_id !== projectId
          || parent.version_id !== versionId
        ))) {
        return { rows: [], rowCount: 0 };
      }
      const row = {
        id,
        version_id: versionId,
        project_id: projectId,
        timecode_sec: timecodeSec,
        end_timecode_sec: endTimecodeSec,
        comment,
        author_name: authorName,
        author_kind: authorKind,
        category,
        is_decision: isDecision,
        parent_id: parentId,
        status: "open",
        like_count: 0,
        created_at: new Date().toISOString(),
      };
      comments.set(String(id), row);
      return { rows: [row], rowCount: 1 };
    }
    if (sql.includes("FROM project_video_comments")) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 0 };
  });
  const rowLockTails = options.sharedRowLockTails ?? new Map<string, Promise<void>>();
  const pool = {
    query: executeQuery,
    connect: vi.fn(async () => {
      const heldLocks: Array<() => void> = [];
      let transactionSnapshot: Map<string, VideoRow> | null = null;
      let locksReleased = false;
      const releaseLocks = () => {
        if (locksReleased) return;
        locksReleased = true;
        for (const release of heldLocks.splice(0)) release();
      };
      return {
        query: vi.fn(async (sql: string, params: unknown[] = []) => {
          if (/^\s*BEGIN\s*$/i.test(sql)) {
            transactionSnapshot = new Map(
              [...versions].map(([key, row]) => [key, { ...row }]),
            );
          }
          if (sql.includes("pg_advisory_xact_lock")
            || (sql.includes("FROM project_video_versions") && sql.includes("FOR UPDATE"))) {
            const key = sql.includes("pg_advisory_xact_lock")
              ? `project:${String(params[0])}`
              : `row:${String(params[1])}:${String(params[0])}`;
            const previous = rowLockTails.get(key) ?? Promise.resolve();
            let unlock!: () => void;
            const held = new Promise<void>((resolve) => { unlock = resolve; });
            const tail = previous.then(() => held);
            rowLockTails.set(key, tail);
            await previous;
            heldLocks.push(() => {
              unlock();
              if (rowLockTails.get(key) === tail) rowLockTails.delete(key);
            });
          }
          try {
            const result = await executeQuery(sql, params);
            if (/^\s*ROLLBACK\s*$/i.test(sql) && transactionSnapshot) {
              versions.clear();
              for (const [key, row] of transactionSnapshot) {
                versions.set(key, { ...row });
              }
              transactionSnapshot = null;
            } else if (/^\s*COMMIT\s*$/i.test(sql)) {
              transactionSnapshot = null;
            }
            return result;
          } finally {
            if (/^\s*(?:COMMIT|ROLLBACK)\s*$/i.test(sql)) releaseLocks();
          }
        }),
        release: vi.fn(releaseLocks),
      };
    }),
  };
  const app = express();
  app.use(express.json());
  setupProjectWorkspaceRoutes({
    app,
    pool,
    requireUserSession: (req) => ({
      userId: String(req.headers["x-test-user-id"] || "owner-user"),
      email: "owner@example.test",
      name: "Owner",
      role: "user",
    }),
    videoUploadMaxBytes: options.videoUploadMaxBytes,
    videoUploadMaxConcurrent: options.videoUploadMaxConcurrent,
    videoDirectUploadMaxBytes: options.videoDirectUploadMaxBytes,
  });
  return { app, queries, versions };
}

describe("project video storage isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    b2.archive.mockResolvedValue({ bucket: "role-room", key: "stored", size: 4 });
    b2.head.mockResolvedValue({ size: 4, contentType: "video/mp4", versionId: "version-1" });
    b2.presignDownload.mockImplementation(async (key: string) => `https://read.example/${key}`);
    b2.presignUpload.mockImplementation(async (key: string) => `https://upload.example/${key}`);
  });

  it.each([
    "workspace/project-2/video-versions/foreign.mp4",
    "storyboard/project-1/video-versions/cross-namespace.mp4",
  ])("rejects client-selected B2 key %s", async (b2Key) => {
    const { app, queries } = createApp();

    const response = await request(app)
      .post("/api/projects/project-1/video-versions")
      .send({ b2Key });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("b2_upload_route_required");
    expect(queries.some(({ sql }) => sql.includes("INSERT INTO project_video_versions"))).toBe(false);
    expect(b2.presignDownload).not.toHaveBeenCalled();
  });

  it("only signs historical keys inside the requested project's exact namespace", async () => {
    const { app } = createApp({
      versions: {
        "project-1": [
          {
            id: "safe",
            version_number: 1,
            b2_key: "workspace/project-1/video-versions/safe.mp4",
            status: "under_review",
          },
          {
            id: "foreign",
            version_number: 2,
            b2_key: "workspace/project-2/video-versions/foreign.mp4",
            file_url: "https://legacy.example/fallback.mp4",
            status: "superseded",
          },
          {
            id: "namespace",
            version_number: 3,
            b2_key: "storyboard/project-1/video-versions/foreign.mp4",
            status: "superseded",
          },
        ],
      },
    });

    const response = await request(app).get("/api/projects/project-1/video-room");

    expect(response.status).toBe(200);
    expect(b2.presignDownload).toHaveBeenCalledTimes(1);
    expect(b2.presignDownload).toHaveBeenCalledWith(
      "workspace/project-1/video-versions/safe.mp4",
      undefined,
      3600,
      undefined,
    );
    expect(response.body.versions.find((v: any) => v.id === "foreign")?.fileUrl)
      .toBe("https://legacy.example/fallback.mp4");
    expect(response.body.versions.find((v: any) => v.id === "namespace")?.fileUrl)
      .toBeNull();
  });

  it("registers a server-generated project key and confirms only in that project", async () => {
    const { app, queries } = createApp();

    const registration = await request(app)
      .post("/api/projects/project-1/video-versions/upload-url")
      .send({
        fileName: "Director cut.mp4",
        contentType: "video/mp4",
        sizeBytes: 4,
        versionLabel: "V1",
      });

    expect(registration.status).toBe(201);
    expect(registration.body).not.toHaveProperty("b2Key");
    const signedKey = String(b2.presignUpload.mock.calls[0]?.[0]);
    expect(signedKey).toMatch(/^workspace\/project-1\/video-versions\/[0-9a-f-]+-director-cut-mp4$/);
    expect(b2.presignUpload).toHaveBeenCalledWith(signedKey, "video/mp4", 3600, 4);
    const insert = queries.find(({ sql }) => sql.includes("INSERT INTO project_video_versions") && sql.includes("content_type"));
    expect(insert?.params[4]).toBe(signedKey);

    const crossProject = await request(app)
      .post(`/api/projects/project-2/video-versions/${registration.body.id}/confirm-upload`)
      .send({});
    expect(crossProject.status).toBe(404);
    expect(b2.head).not.toHaveBeenCalled();

    const confirmed = await request(app)
      .post(`/api/projects/project-1/video-versions/${registration.body.id}/confirm-upload`)
      .send({});
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe("under_review");
    expect(b2.head).toHaveBeenCalledWith(signedKey);

    // Selv om samme PUT-URL replays og oppretter en nyere B2-versjon, skal
    // playback fortsatt signeres mot versjonen som confirm HEAD-verifiserte.
    b2.head.mockResolvedValue({ size: 4, contentType: "video/mp4", versionId: "version-2" });
    const playback = await request(app).get("/api/projects/project-1/video-room");
    expect(playback.status).toBe(200);
    expect(b2.presignDownload).toHaveBeenCalledWith(signedKey, undefined, 3600, "version-1");
  });

  it("serializes overlapping confirmation retries without losing the review version", async () => {
    let headCalls = 0;
    let releaseHeads!: () => void;
    const bothHeadsStarted = new Promise<void>((resolve) => { releaseHeads = resolve; });
    b2.head.mockImplementation(async () => {
      headCalls += 1;
      if (headCalls === 2) releaseHeads();
      await bothHeadsStarted;
      return { size: 4, contentType: "video/mp4", versionId: "version-2" };
    });
    const { app, queries, versions } = createApp({
      versions: {
        "project-1": [
          {
            id: "current",
            version_number: 1,
            b2_key: "workspace/project-1/video-versions/current.mp4",
            status: "under_review",
          },
          {
            id: "pending",
            version_number: 2,
            b2_key: "workspace/project-1/video-versions/pending.mp4",
            content_type: "video/mp4",
            size_bytes: 4,
            status: "upload_pending",
          },
        ],
      },
    });

    const [first, retry] = await Promise.all([
      request(app)
        .post("/api/projects/project-1/video-versions/pending/confirm-upload")
        .send({}),
      request(app)
        .post("/api/projects/project-1/video-versions/pending/confirm-upload")
        .send({}),
    ]);

    expect([first.status, retry.status]).toEqual([200, 200]);
    expect(first.body.status).toBe("under_review");
    expect(retry.body.status).toBe("under_review");
    expect(versions.get("project-1:pending")?.status).toBe("under_review");
    expect(versions.get("project-1:current")?.status).toBe("superseded");
    expect(queries.filter(({ sql }) => sql.includes("FOR UPDATE"))).toHaveLength(2);
    expect(queries.filter(({ sql }) => (
      sql.includes("SET status='under_review', upload_expires_at=NULL")
    ))).toHaveLength(1);
  });

  it("serializes confirmations for different pending versions in the same project", async () => {
    let headCalls = 0;
    let releaseHeads!: () => void;
    const bothHeadsStarted = new Promise<void>((resolve) => { releaseHeads = resolve; });
    b2.head.mockImplementation(async () => {
      headCalls += 1;
      if (headCalls === 2) releaseHeads();
      await bothHeadsStarted;
      return { size: 4, contentType: "video/mp4", versionId: "version-from-head" };
    });
    const { app, queries, versions } = createApp({
      versions: {
        "project-1": [
          {
            id: "current",
            version_number: 1,
            b2_key: "workspace/project-1/video-versions/current.mp4",
            status: "under_review",
          },
          {
            id: "pending-a",
            version_number: 2,
            b2_key: "workspace/project-1/video-versions/pending-a.mp4",
            content_type: "video/mp4",
            size_bytes: 4,
            status: "upload_pending",
          },
          {
            id: "pending-b",
            version_number: 3,
            b2_key: "workspace/project-1/video-versions/pending-b.mp4",
            content_type: "video/mp4",
            size_bytes: 4,
            status: "upload_pending",
          },
        ],
      },
    });

    const responses = await Promise.all([
      request(app)
        .post("/api/projects/project-1/video-versions/pending-a/confirm-upload")
        .send({}),
      request(app)
        .post("/api/projects/project-1/video-versions/pending-b/confirm-upload")
        .send({}),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    expect(responses.map(({ body }) => body.status)).toEqual(["under_review", "under_review"]);
    const finalStatuses = [
      versions.get("project-1:pending-a")?.status,
      versions.get("project-1:pending-b")?.status,
    ];
    expect(finalStatuses.filter((status) => status === "under_review")).toHaveLength(1);
    expect(finalStatuses.filter((status) => status === "superseded")).toHaveLength(1);
    expect(versions.get("project-1:current")?.status).toBe("superseded");
    expect(queries.filter(({ sql }) => sql.includes("pg_advisory_xact_lock"))).toHaveLength(2);
    expect(queries.filter(({ sql }) => (
      sql.includes("SET status='under_review', upload_expires_at=NULL")
    ))).toHaveLength(2);
  });

  it("serializes direct confirmation with legacy publication for the same project", async () => {
    let writersReady = 0;
    let releaseWriters!: () => void;
    const bothWritersReady = new Promise<void>((resolve) => { releaseWriters = resolve; });
    const meetAtStorageBarrier = async () => {
      writersReady += 1;
      if (writersReady === 2) releaseWriters();
      await bothWritersReady;
    };
    b2.head.mockImplementation(async () => {
      await meetAtStorageBarrier();
      return { size: 4, contentType: "video/mp4", versionId: "direct-version" };
    });
    b2.archive.mockImplementation(async () => {
      await meetAtStorageBarrier();
      return {
        bucket: "role-room",
        key: "stored",
        size: 4,
        versionId: "legacy-version",
      };
    });
    const { app, queries, versions } = createApp({
      videoUploadMaxBytes: 1024,
      versions: {
        "project-1": [
          {
            id: "current",
            version_number: 1,
            b2_key: "workspace/project-1/video-versions/current.mp4",
            status: "under_review",
          },
          {
            id: "pending",
            version_number: 2,
            b2_key: "workspace/project-1/video-versions/pending.mp4",
            content_type: "video/mp4",
            size_bytes: 4,
            status: "upload_pending",
          },
        ],
      },
    });

    const [direct, legacy] = await Promise.all([
      request(app)
        .post("/api/projects/project-1/video-versions/pending/confirm-upload")
        .send({}),
      request(app)
        .post("/api/projects/project-1/video-versions/upload")
        .attach("file", Buffer.from("clip"), { filename: "legacy.mp4", contentType: "video/mp4" }),
    ]);

    expect(direct.status).toBe(200);
    expect(legacy.status).toBe(201);
    expect(legacy.body.versionNumber).toBe(3);
    const projectRows = [...versions.entries()]
      .filter(([key]) => key.startsWith("project-1:"))
      .map(([, row]) => row);
    expect(projectRows.map((row) => row.version_number).sort((a, b) => a - b))
      .toEqual([1, 2, 3]);
    expect(projectRows.filter((row) => row.status === "under_review")).toHaveLength(1);
    const locks = queries.filter(({ sql }) => sql.includes("pg_advisory_xact_lock"));
    expect(locks).toHaveLength(2);
    expect(new Set(locks.map(({ params }) => params[0]))).toEqual(
      new Set(["project-video-review:project-1"]),
    );
  });

  it("rolls back the previous review supersede when publishing fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { app, queries, versions } = createApp({
        failDirectUploadPromotion: true,
        versions: {
          "project-1": [
            {
              id: "current",
              version_number: 1,
              b2_key: "workspace/project-1/video-versions/current.mp4",
              status: "under_review",
            },
            {
              id: "pending",
              version_number: 2,
              b2_key: "workspace/project-1/video-versions/pending.mp4",
              content_type: "video/mp4",
              size_bytes: 4,
              status: "upload_pending",
            },
          ],
        },
      });

      const response = await request(app)
        .post("/api/projects/project-1/video-versions/pending/confirm-upload")
        .send({});

      expect(response.status).toBe(500);
      expect(versions.get("project-1:pending")?.status).toBe("upload_pending");
      expect(versions.get("project-1:current")?.status).toBe("under_review");
      expect(queries.some(({ sql }) => /^\s*ROLLBACK\s*$/i.test(sql))).toBe(true);
      expect(queries.some(({ sql }) => (
        sql.includes("SET status='under_review', upload_expires_at=NULL")
      ))).toBe(true);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("rejects an oversized direct upload before issuing a signed URL", async () => {
    const { app } = createApp({ videoDirectUploadMaxBytes: 4 });

    const response = await request(app)
      .post("/api/projects/project-1/video-versions/upload-url")
      .send({ fileName: "large.mp4", contentType: "video/mp4", sizeBytes: 5 });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: "video_too_large", maxBytes: 4 });
    expect(b2.presignUpload).not.toHaveBeenCalled();
  });

  it("refuses to HEAD or confirm a poisoned registered key", async () => {
    const { app } = createApp({
      versions: {
        "project-1": [{
          id: "poisoned",
          version_number: 1,
          b2_key: "workspace/project-2/video-versions/foreign.mp4",
          content_type: "video/mp4",
          size_bytes: 4,
          status: "upload_pending",
        }],
      },
    });

    const response = await request(app)
      .post("/api/projects/project-1/video-versions/poisoned/confirm-upload")
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("invalid_video_storage_key");
    expect(b2.head).not.toHaveBeenCalled();
  });

  it("does not publish a direct upload whose B2 metadata differs from registration", async () => {
    b2.head.mockResolvedValueOnce({ size: 5, contentType: "video/mp4", versionId: "version-1" });
    const { app, queries } = createApp({
      versions: {
        "project-1": [{
          id: "pending",
          version_number: 1,
          b2_key: "workspace/project-1/video-versions/pending.mp4",
          content_type: "video/mp4",
          size_bytes: 4,
          status: "upload_pending",
        }],
      },
    });

    const response = await request(app)
      .post("/api/projects/project-1/video-versions/pending/confirm-upload")
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("upload_metadata_mismatch");
    expect(queries.some(({ sql }) => sql.includes("SET status='under_review', upload_expires_at=NULL")))
      .toBe(false);
  });

  it("fails closed when B2 cannot identify an immutable uploaded version", async () => {
    b2.head.mockResolvedValueOnce({ size: 4, contentType: "video/mp4", versionId: null });
    const { app } = createApp({
      versions: {
        "project-1": [{
          id: "pending-no-version",
          version_number: 1,
          b2_key: "workspace/project-1/video-versions/pending.mp4",
          content_type: "video/mp4",
          size_bytes: 4,
          status: "upload_pending",
        }],
      },
    });

    const response = await request(app)
      .post("/api/projects/project-1/video-versions/pending-no-version/confirm-upload")
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("upload_version_unavailable");
  });

  it("does not attach a comment or reply across project/version boundaries", async () => {
    const projectOneVersion = "11111111-1111-4111-8111-111111111111";
    const projectTwoVersion = "22222222-2222-4222-8222-222222222222";
    const { app } = createApp({
      versions: {
        "project-1": [{
          id: projectOneVersion,
          version_number: 1,
          status: "under_review",
        }],
        "project-2": [{
          id: projectTwoVersion,
          version_number: 1,
          status: "under_review",
        }],
      },
    });

    const foreignVersion = await request(app)
      .post("/api/projects/project-1/video-comments")
      .send({ versionId: projectTwoVersion, comment: "cross-project" });
    expect(foreignVersion.status).toBe(404);
    expect(foreignVersion.body.error).toBe("video_version_or_parent_not_found");

    const foreignParent = await request(app)
      .post("/api/projects/project-2/video-comments")
      .send({ versionId: projectTwoVersion, comment: "valid parent" });
    expect(foreignParent.status).toBe(201);

    const crossProjectReply = await request(app)
      .post("/api/projects/project-1/video-comments")
      .send({
        versionId: projectOneVersion,
        parentId: foreignParent.body.id,
        comment: "cross-project reply",
      });
    expect(crossProjectReply.status).toBe(404);
    expect(crossProjectReply.body.error).toBe("video_version_or_parent_not_found");

    const localComment = await request(app)
      .post("/api/projects/project-1/video-comments")
      .send({ versionId: projectOneVersion, comment: "local" });
    expect(localComment.status).toBe(201);
  });
});

describe("legacy project video upload memory guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    b2.archive.mockResolvedValue({ bucket: "role-room", key: "stored", size: 4 });
  });

  it("returns an explicit 413 above the injected hard cap before B2 upload", async () => {
    const { app } = createApp({ videoUploadMaxBytes: 4 });

    const response = await request(app)
      .post("/api/projects/project-1/video-versions/upload")
      .attach("file", Buffer.from("12345"), { filename: "clip.mp4", contentType: "video/mp4" });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: "video_too_large", maxBytes: 4 });
    expect(b2.archive).not.toHaveBeenCalled();
  });

  it("admits only one in-memory upload at a time and releases the slot", async () => {
    let releaseFirst!: (value: { bucket: string; key: string; size: number }) => void;
    b2.archive.mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }));
    const { app } = createApp({ videoUploadMaxBytes: 1024, videoUploadMaxConcurrent: 1 });

    const firstPromise = request(app)
      .post("/api/projects/project-1/video-versions/upload")
      .attach("file", Buffer.from("one"), { filename: "one.mp4", contentType: "video/mp4" })
      .then((response) => response);
    await vi.waitFor(() => expect(b2.archive).toHaveBeenCalledTimes(1));

    const second = await request(app)
      .post("/api/projects/project-2/video-versions/upload")
      .attach("file", Buffer.from("two"), { filename: "two.mp4", contentType: "video/mp4" });
    expect(second.status).toBe(429);
    expect(second.headers["retry-after"]).toBe("5");
    expect(second.body.error).toBe("video_upload_busy");

    releaseFirst({ bucket: "role-room", key: "stored", size: 3 });
    const first = await firstPromise;
    expect(first.status).toBe(201);

    const afterRelease = await request(app)
      .post("/api/projects/project-2/video-versions/upload")
      .attach("file", Buffer.from("two"), { filename: "two.mp4", contentType: "video/mp4" });
    expect(afterRelease.status).toBe(201);
  });

  it("serializes legacy writers across server instances for the same project", async () => {
    let uploadsReady = 0;
    let releaseUploads!: () => void;
    const bothUploadsReady = new Promise<void>((resolve) => { releaseUploads = resolve; });
    b2.archive.mockImplementation(async (_key: string) => {
      uploadsReady += 1;
      if (uploadsReady === 2) releaseUploads();
      await bothUploadsReady;
      return {
        bucket: "role-room",
        key: "stored",
        size: 3,
        versionId: `legacy-version-${uploadsReady}`,
      };
    });
    const sharedVersions = new Map<string, VideoRow>();
    const sharedQueries: Array<{ sql: string; params: unknown[] }> = [];
    const sharedRowLockTails = new Map<string, Promise<void>>();
    const firstServer = createApp({
      videoUploadMaxBytes: 1024,
      sharedVersions,
      sharedQueries,
      sharedRowLockTails,
    });
    const secondServer = createApp({
      videoUploadMaxBytes: 1024,
      sharedVersions,
      sharedQueries,
      sharedRowLockTails,
    });
    const { queries, versions } = firstServer;

    const responses = await Promise.all([
      request(firstServer.app)
        .post("/api/projects/project-1/video-versions/upload")
        .set("x-test-user-id", "editor-a")
        .attach("file", Buffer.from("one"), { filename: "one.mp4", contentType: "video/mp4" }),
      request(secondServer.app)
        .post("/api/projects/project-1/video-versions/upload")
        .set("x-test-user-id", "editor-b")
        .attach("file", Buffer.from("two"), { filename: "two.mp4", contentType: "video/mp4" }),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    expect(responses.map(({ body }) => body.versionNumber).sort((a, b) => a - b))
      .toEqual([1, 2]);
    const projectRows = [...versions.entries()]
      .filter(([key]) => key.startsWith("project-1:"))
      .map(([, row]) => row);
    expect(projectRows).toHaveLength(2);
    expect(projectRows.map((row) => row.version_number).sort((a, b) => a - b))
      .toEqual([1, 2]);
    expect(projectRows.filter((row) => row.status === "under_review")).toHaveLength(1);
    expect(projectRows.filter((row) => row.status === "superseded")).toHaveLength(1);
    const locks = queries.filter(({ sql }) => sql.includes("pg_advisory_xact_lock"));
    expect(locks).toHaveLength(2);
    expect(new Set(locks.map(({ params }) => params[0]))).toEqual(
      new Set(["project-video-review:project-1"]),
    );
  });
});
