import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveOrg: vi.fn(),
  loadProject: vi.fn(),
  entitled: vi.fn(),
  putObject: vi.fn(),
  getObjectBuffer: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock("./leadgrid-org-resolver.js", () => ({
  resolveOrgIdForUser: mocks.resolveOrg,
}));
vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: mocks.loadProject,
}));
vi.mock("./leadgrid-entitlement-guard.js", () => ({
  assertAnyEntitled: mocks.entitled,
  LEADGRID_CANVAS_FEATURE_KEYS: ["leadgridCanvas"],
}));
vi.mock("./leadgrid-s3-storage-service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./leadgrid-s3-storage-service.js")>();
  return {
    ...actual,
    getLeadgridObjectStorage: () => ({
      provider: "aws_s3",
      bucket: "leadgrid-prod-745600963362-eu-north-1",
      putObject: mocks.putObject,
      getObjectBuffer: mocks.getObjectBuffer,
      deleteObject: mocks.deleteObject,
    }),
  };
});

import { registerLeadgridCanvasRoutes } from "./leadgrid-canvas-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";
const noteId = "22222222-2222-4222-8222-222222222222";
const otherNoteId = "33333333-3333-4333-8333-333333333333";

function appWith(query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json({ limit: "30mb" }));
  registerLeadgridCanvasRoutes({
    app,
    pool: { query } as never,
    requireUserSession: () => ({ userId: "user-1" }),
  });
  return app;
}

function isSchemaSql(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();
  return normalized.startsWith("CREATE TABLE") ||
    normalized.startsWith("CREATE INDEX") ||
    normalized.startsWith("ALTER TABLE");
}

describe("Leadgrid Canvas AWS S3 document contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveOrg.mockResolvedValue(organizationId);
    mocks.loadProject.mockResolvedValue({
      id: projectId,
      organizationId,
      name: "Dentum",
    });
    mocks.entitled.mockResolvedValue(true);
    mocks.deleteObject.mockResolvedValue(undefined);
    mocks.putObject.mockImplementation(async ({ key, body }) => ({
      provider: "aws_s3",
      bucket: "leadgrid-prod-745600963362-eu-north-1",
      key,
      checksumSha256: "d".repeat(64),
      sizeBytes: body.byteLength,
    }));
  });

  it("requires an explicit accessible project before reading Canvas data", async () => {
    const query = vi.fn();
    const missing = await request(appWith(query)).get("/api/leadgrid/canvas");

    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe("project_id_required");
    expect(mocks.loadProject).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();

    mocks.loadProject.mockResolvedValueOnce(null);
    const inaccessible = await request(appWith(query))
      .get("/api/leadgrid/canvas")
      .query({ projectId: "creatorhub" });

    expect(inaccessible.status).toBe(404);
    expect(inaccessible.body.error).toBe("project_not_found");
    expect(query).not.toHaveBeenCalled();
  });

  it("stores a PDF original in S3 and keeps only metadata in PostgreSQL", async () => {
    const query = vi.fn(async (sql: string) => {
      if (isSchemaSql(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM leadgrid_canvas_notater")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("FROM leadgrid_canvas_dokumenter") && sql.includes("WHERE id")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("WITH stored AS")) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected query: ${sql}`);
    });
    const pdf = Buffer.from("%PDF-1.7\ncanvas");
    const response = await request(appWith(query))
      .post(`/api/leadgrid/canvas/${noteId}/dokumenter`)
      .query({ projectId })
      .send({ id: "document-1", navn: "Plan.pdf", base64: pdf.toString("base64") });

    expect(response.status).toBe(200);
    const upload = mocks.putObject.mock.calls[0]?.[0];
    expect(upload.key).toMatch(
      new RegExp(`^organizations/${organizationId}/projects/[0-9a-f-]{36}/users/[0-9a-f-]{36}/files/[0-9a-f-]{36}/original$`),
    );
    expect(upload.purpose).toBe("canvas_document");
    const registration = query.mock.calls.find(([sql]) => String(sql).includes("WITH stored AS"));
    expect(String(registration?.[0])).toContain("INSERT INTO leadgrid_storage_objects");
    expect(String(registration?.[0])).toContain("base64 = ''");
  });

  it("does not allow a client document ID to move between notes", async () => {
    const query = vi.fn(async (sql: string) => {
      if (isSchemaSql(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM leadgrid_canvas_notater")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("FROM leadgrid_canvas_dokumenter")) {
        return {
          rows: [{
            user_id: "user-1",
            organization_id: organizationId,
            notat_id: otherNoteId,
            storage_provider: "aws_s3",
            storage_object_id: "44444444-4444-4444-8444-444444444444",
            storage_key: "organizations/existing",
          }],
        };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const response = await request(appWith(query))
      .post(`/api/leadgrid/canvas/${noteId}/dokumenter`)
      .query({ projectId })
      .send({
        id: "document-1",
        navn: "Plan.pdf",
        base64: Buffer.from("%PDF-1.7\ncanvas").toString("base64"),
      });

    expect(response.status).toBe(404);
    expect(mocks.putObject).not.toHaveBeenCalled();
  });

  it("reads AWS bytes on demand without changing the iPad response contract", async () => {
    const pdf = Buffer.from("%PDF-1.7\nread");
    mocks.getObjectBuffer.mockResolvedValue(pdf);
    const objectKey = `organizations/${organizationId}/users/user/files/object/original`;
    const query = vi.fn(async (sql: string) => {
      if (isSchemaSql(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes("JOIN leadgrid_canvas_notater")) {
        return {
          rows: [{
            id: "document-1",
            navn: "Plan.pdf",
            base64: "",
            storage_provider: "aws_s3",
            storage_key: objectKey,
          }],
        };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const response = await request(appWith(query))
      .get("/api/leadgrid/canvas/dokumenter/document-1")
      .query({ projectId });

    expect(response.status).toBe(200);
    expect(response.body.dokument.base64).toBe(pdf.toString("base64"));
    expect(mocks.getObjectBuffer).toHaveBeenCalledWith(objectKey, 20 * 1024 * 1024);
  });
});
