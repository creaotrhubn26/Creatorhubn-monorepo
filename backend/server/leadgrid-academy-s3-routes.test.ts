import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveOrg: vi.fn(),
  createUploadUrl: vi.fn(),
  finalizeTemporaryObject: vi.fn(),
  createDownloadUrl: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock("./leadgrid-org-resolver.js", () => ({
  resolveOrgIdForUser: mocks.resolveOrg,
}));
vi.mock("./leadgrid-s3-storage-service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./leadgrid-s3-storage-service.js")>();
  return {
    ...actual,
    getLeadgridObjectStorage: () => ({
      provider: "aws_s3",
      bucket: "leadgrid-prod-745600963362-eu-north-1",
      createUploadUrl: mocks.createUploadUrl,
      finalizeTemporaryObject: mocks.finalizeTemporaryObject,
      createDownloadUrl: mocks.createDownloadUrl,
      deleteObject: mocks.deleteObject,
    }),
  };
});

import { registerLeadgridAcademyRoutes } from "./leadgrid-academy-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const courseId = "22222222-2222-4222-8222-222222222222";
const chapterId = "33333333-3333-4333-8333-333333333333";
const uploadId = "44444444-4444-4444-8444-444444444444";
const temporaryKey =
  `temporary/organizations/${organizationId}/academy/chapters/${chapterId}` +
  `/uploads/${uploadId}/original`;

function appWith(query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  registerLeadgridAcademyRoutes({
    app,
    pool: { query } as never,
    requireUserSession: () => ({
      userId: "admin-1",
      email: "admin@example.no",
      name: "Admin",
      role: "super_admin",
    }),
  });
  return app;
}

function ownedChapterRow() {
  return {
    chapter_id: chapterId,
    course_id: courseId,
    video_r2_key: null,
    video_storage_provider: "legacy_b2",
    video_storage_object_id: null,
  };
}

describe("Leadgrid Academy AWS S3 route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveOrg.mockResolvedValue(organizationId);
    mocks.createUploadUrl.mockResolvedValue("https://signed.example/upload");
    mocks.createDownloadUrl.mockResolvedValue("https://signed.example/video");
    mocks.deleteObject.mockResolvedValue(undefined);
  });

  it("issues only an opaque temporary upload key for an owned org chapter", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("video_storage_provider")) return { rows: [ownedChapterRow()] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const response = await request(appWith(query))
      .post(`/api/leadgrid/academy/chapters/${chapterId}/video-upload-url`)
      .send({ content_type: "video/mp4" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      url: "https://signed.example/upload",
      storage_provider: "aws_s3",
    });
    expect(response.body.key).toMatch(
      new RegExp(`^temporary/organizations/${organizationId}/academy/chapters/${chapterId}/uploads/[0-9a-f-]{36}/original$`),
    );
    expect(mocks.createUploadUrl).toHaveBeenCalledWith(expect.objectContaining({
      key: response.body.key,
      contentType: "video/mp4",
    }));
  });

  it("finalizes a temporary upload and registers AWS metadata atomically", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("video_storage_provider") && sql.includes("SELECT ch.id")) {
        return { rows: [ownedChapterRow()] };
      }
      if (sql.includes("WITH stored AS")) return { rows: [{ id: chapterId }], rowCount: 1 };
      throw new Error(`unexpected query: ${sql}`);
    });
    mocks.finalizeTemporaryObject.mockImplementation(async ({ finalKey }) => ({
      provider: "aws_s3",
      bucket: "leadgrid-prod-745600963362-eu-north-1",
      key: finalKey,
      checksumSha256: "a".repeat(64),
      sizeBytes: 1024,
      contentType: "video/mp4",
    }));

    const response = await request(appWith(query))
      .post(`/api/leadgrid/academy/chapters/${chapterId}/video-attach`)
      .send({ key: temporaryKey, duration_seconds: 90 });

    expect(response.status).toBe(200);
    expect(mocks.finalizeTemporaryObject).toHaveBeenCalledWith(expect.objectContaining({
      temporaryKey,
      allowedContentTypes: ["video/mp4", "video/quicktime", "video/x-m4v"],
      purpose: "academy_video",
    }));
    const registration = query.mock.calls.find(([sql]) => String(sql).includes("WITH stored AS"));
    expect(String(registration?.[0])).toContain("INSERT INTO leadgrid_storage_objects");
    expect(String(registration?.[0])).toContain("video_storage_provider = 'aws_s3'");
    expect(registration?.[1]?.[1]).toBe(organizationId);
  });

  it("rejects another chapter's temporary key before touching S3", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("video_storage_provider")) return { rows: [ownedChapterRow()] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const foreignChapter = "55555555-5555-4555-8555-555555555555";
    const response = await request(appWith(query))
      .post(`/api/leadgrid/academy/chapters/${chapterId}/video-attach`)
      .send({ key: temporaryKey.replace(chapterId, foreignChapter) });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("ugyldig_key");
    expect(mocks.finalizeTemporaryObject).not.toHaveBeenCalled();
  });

  it("uses the dedicated storage provider for playback of new videos", async () => {
    const objectKey =
      `organizations/${organizationId}/shared/academy/courses/${courseId}` +
      `/chapters/${chapterId}/videos/${uploadId}/original`;
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("c.is_published = TRUE")) {
        return {
          rows: [{ video_r2_key: objectKey, video_storage_provider: "aws_s3" }],
        };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const response = await request(appWith(query))
      .get(`/api/leadgrid/academy/chapters/${chapterId}/video-url`);

    expect(response.status).toBe(200);
    expect(response.body.url).toBe("https://signed.example/video");
    expect(mocks.createDownloadUrl).toHaveBeenCalledWith(objectKey, 1800);
  });
});
