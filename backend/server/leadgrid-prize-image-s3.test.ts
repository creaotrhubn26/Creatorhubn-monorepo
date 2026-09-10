import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveOrg: vi.fn(),
  putObject: vi.fn(),
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
      putObject: mocks.putObject,
      createDownloadUrl: mocks.createDownloadUrl,
      deleteObject: mocks.deleteObject,
    }),
  };
});

import { hydrateLeadgridPrizeImageUrls } from "./leadgrid-prize-image-service.js";
import { registerSalesLeadershipRoutes } from "./sales-leadership-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";

describe("Leadgrid prize image AWS S3 contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveOrg.mockResolvedValue(organizationId);
    mocks.createDownloadUrl.mockResolvedValue("https://signed.example/prize");
    mocks.deleteObject.mockResolvedValue(undefined);
    mocks.putObject.mockImplementation(async ({ key, body }) => ({
      provider: "aws_s3",
      bucket: "leadgrid-prod-745600963362-eu-north-1",
      key,
      checksumSha256: "b".repeat(64),
      sizeBytes: body.byteLength,
    }));
  });

  it("stores a validated image under the organization without its filename", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO leadgrid_storage_objects")) {
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const app = express();
    registerSalesLeadershipRoutes({
      app,
      pool: { query } as never,
      requireUserSession: () => ({
        userId: "admin-1",
        email: "admin@example.no",
        name: "Admin",
        role: "super_admin",
      }),
    });
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("test-image"),
    ]);
    const response = await request(app)
      .post("/api/leadgrid/sales-leadership/prize-catalog/upload-image")
      .attach("image", png, { filename: "Kundens premie.png", contentType: "image/png" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      image_url: "https://signed.example/prize",
      storage_provider: "aws_s3",
    });
    const uploaded = mocks.putObject.mock.calls[0]?.[0];
    expect(uploaded.key).toMatch(
      new RegExp(`^organizations/${organizationId}/shared/sales-prizes/[0-9a-f-]{36}/original$`),
    );
    expect(uploaded.key).not.toContain("Kundens");
    expect(uploaded.purpose).toBe("sales_prize_image");
  });

  it("replaces an AWS key with a fresh signed URL without persisting it", async () => {
    const key = `organizations/${organizationId}/shared/sales-prizes/22222222-2222-4222-8222-222222222222/original`;
    const [row] = await hydrateLeadgridPrizeImageUrls([{
      id: "prize-1",
      image_url: "https://expired.example",
      image_b2_key: key,
      image_storage_provider: "aws_s3" as const,
    }]);

    expect(row.image_url).toBe("https://signed.example/prize");
    expect(mocks.createDownloadUrl).toHaveBeenCalledWith(key, 600);
  });
});
