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
} = {}) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const versions = new Map<string, VideoRow>();
  const comments = new Map<string, Record<string, unknown>>();
  for (const [projectId, rows] of Object.entries(options.versions || {})) {
    for (const row of rows) versions.set(`${projectId}:${row.id}`, { ...row });
  }

  const pool = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes("SELECT 1 WHERE EXISTS")) {
        return { rows: [{ ok: 1 }], rowCount: 1 };
      }
      if (sql.includes("SELECT COALESCE(MAX(version_number),0)+1 AS n")) {
        return { rows: [{ n: 1 }], rowCount: 1 };
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
      if (sql.includes("SET status='under_review', upload_expires_at=NULL, storage_version_id=$3")) {
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
    }),
  };
  const app = express();
  app.use(express.json());
  setupProjectWorkspaceRoutes({
    app,
    pool,
    requireUserSession: () => ({
      userId: "owner-user",
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
});
