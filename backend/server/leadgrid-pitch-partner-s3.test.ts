import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  putObject: vi.fn(),
  createDownloadUrl: vi.fn(),
  deleteObject: vi.fn(),
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

import {
  deletePartnerDocument,
  presignPartnerDocument,
  uploadPartnerDocument,
} from "./partner-documents-service.js";
import {
  buildAssetUrlMap,
  matchesImageSignature,
} from "./pitch-deck-asset-service.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const applicationId = "22222222-2222-4222-8222-222222222222";

describe("Leadgrid Pitch Deck and partner-document AWS S3 contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.putObject.mockImplementation(async ({ key, body }) => ({
      provider: "aws_s3",
      bucket: "leadgrid-prod-745600963362-eu-north-1",
      key,
      checksumSha256: "c".repeat(64),
      sizeBytes: body.byteLength,
    }));
    mocks.createDownloadUrl.mockResolvedValue("https://signed.example/object");
    mocks.deleteObject.mockResolvedValue(undefined);
  });

  it("rejects mismatched Pitch Deck image signatures", () => {
    expect(matchesImageSignature(Buffer.from("not-a-png"), "image/png")).toBe(false);
    expect(matchesImageSignature(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      "image/png",
    )).toBe(true);
  });

  it("hydrates AWS Pitch Deck assets with a short-lived URL", async () => {
    const key = `organizations/${organizationId}/shared/pitch-decks/${applicationId}/object`;
    const pool = {
      query: vi.fn(async () => ({
        rows: [{ id: "asset-1", b2_key: key, storage_provider: "aws_s3" }],
      })),
    };
    const urls = await buildAssetUrlMap(pool as never, applicationId, organizationId);
    expect(urls).toEqual({ "asset-1": "https://signed.example/object" });
    expect(mocks.createDownloadUrl).toHaveBeenCalledWith(key, 600);
    expect(pool.query.mock.calls[0]?.[1]).toEqual([applicationId, organizationId]);
  });

  it("stores a verified partner PDF without exposing its filename in the S3 key", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("WITH stored AS")) {
        return { rows: [{ id: "33333333-3333-4333-8333-333333333333" }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const result = await uploadPartnerDocument({ query } as never, {
      applicationId,
      organizationId,
      documentType: "privacy_policy",
      filename: "Dentum personvern.pdf",
      mimeType: "application/pdf",
      fileBuffer: Buffer.from("%PDF-1.7\nverified"),
      uploadedBy: "user-1",
    });

    expect(result.ok).toBe(true);
    const upload = mocks.putObject.mock.calls[0]?.[0];
    expect(upload.key).toMatch(
      new RegExp(`^organizations/${organizationId}/shared/partner-applications/${applicationId}/documents/[0-9a-f-]{36}/original$`),
    );
    expect(upload.key).not.toContain("Dentum");
    expect(String(query.mock.calls[0]?.[0])).toContain("INSERT INTO leadgrid_storage_objects");
  });

  it("rejects a forged PDF before upload", async () => {
    const result = await uploadPartnerDocument({ query: vi.fn() } as never, {
      applicationId,
      organizationId,
      documentType: "privacy_policy",
      filename: "fake.pdf",
      mimeType: "application/pdf",
      fileBuffer: Buffer.from("executable-content"),
      uploadedBy: "user-1",
    });
    expect(result).toMatchObject({ ok: false });
    expect(mocks.putObject).not.toHaveBeenCalled();
  });

  it("uses AWS for signed reads and deletes both bytes and metadata", async () => {
    expect(await presignPartnerDocument("organizations/key", 600, "aws_s3"))
      .toBe("https://signed.example/object");
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT storage_url")) {
        return {
          rows: [{
            storage_url: "organizations/key",
            storage_provider: "aws_s3",
            storage_object_id: "44444444-4444-4444-8444-444444444444",
          }],
        };
      }
      return { rows: [], rowCount: 1 };
    });
    expect(await deletePartnerDocument({ query } as never, "doc-1")).toBe(true);
    expect(mocks.deleteObject).toHaveBeenCalledWith("organizations/key");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("DELETE FROM leadgrid_storage_objects"))).toBe(true);
  });
});
