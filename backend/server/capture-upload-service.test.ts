import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  sign: vi.fn(async () => "https://creatorhub-s3.example/signed"),
}));

vi.mock("./creatorhub-object-storage.js", () => ({
  getCreatorHubObjectStorage: () => ({
    client: { send: mocks.send },
    bucket: "creatorhub-private",
    region: "eu-north-1",
    provider: "aws_s3",
  }),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => mocks.sign(...args),
}));

import {
  describeCaptureStorageKey,
  signPartUrls,
  startMultipartUpload,
} from "./capture-upload-service.js";

function ownedAssetDb(projectId = "project-1") {
  const chain: any = {};
  chain.from = () => chain;
  chain.innerJoin = () => chain;
  chain.where = () => chain;
  chain.limit = async () => [{
    sessionId: "00000000-0000-4000-8000-000000000001",
    originalFilename: "IMG 0001.CR3",
    projectId,
  }];
  return { select: () => chain } as any;
}

describe("Capture uploads in CreatorHub S3", () => {
  beforeEach(() => {
    mocks.send.mockReset();
    mocks.sign.mockClear();
    mocks.send.mockResolvedValue({ UploadId: "upload-1" });
  });

  it("starts new multipart uploads in the CreatorHub bucket and tenant prefix", async () => {
    const result = await startMultipartUpload(
      ownedAssetDb(),
      "user-1",
      "00000000-0000-4000-8000-000000000002",
      "raw",
      12 * 1024 * 1024,
      "image/x-canon-cr3",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.bucket).toBe("creatorhub-private");
    expect(result.result.key).toContain("/users/user-1/projects/project-1/photo-room/capture/");
    expect(result.result.key.endsWith("/raw/original.cr3")).toBe(true);
    expect(describeCaptureStorageKey(result.result.key)).toEqual({
      bucket: "creatorhub-private",
      storage: "creatorhub_s3",
    });
  });

  it("will not sign a canonical key outside the owning project prefix", async () => {
    const result = await signPartUrls(
      ownedAssetDb(),
      "user-1",
      "00000000-0000-4000-8000-000000000002",
      "upload-1",
      "organizations/personal-attacker/users/attacker/projects/project-2/photo-room/capture/sessions/s/assets/a/raw/original.cr3",
      [1],
    );
    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});
