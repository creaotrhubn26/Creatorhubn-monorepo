import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDirectStreamTusUpload,
  getStreamVideoStatus,
  importStreamFromUrl,
} from "./cloudflare-stream-service.js";

const originalEnv = { ...process.env };

describe("Cloudflare Stream resumable ingest and ready state", () => {
  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "account-1";
    process.env.CLOUDFLARE_STREAM_API_TOKEN = "stream-secret";
    process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN = "customer-id";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("provisions a private TUS URL without exposing the Stream token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", {
      status: 201,
      headers: { location: "https://upload.videodelivery.net/tus/one-time", "stream-media-id": "media-1" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const ticket = await createDirectStreamTusUpload({
      sizeBytes: 300_000_000, filename: "Master Film.mov", creatorId: "creator-hash", projectId: "project-1", versionId: "version-1",
    });
    expect(ticket).toMatchObject({ uid: "media-1", protocol: "tus", uploadUrl: "https://upload.videodelivery.net/tus/one-time" });
    const [, request] = fetchMock.mock.calls[0];
    expect(request.headers).toMatchObject({
      Authorization: "Bearer stream-secret", "Tus-Resumable": "1.0.0", "Upload-Length": "300000000",
    });
    expect(request.headers["Upload-Metadata"]).toContain("requiresignedurls");
    expect(JSON.stringify(ticket)).not.toContain("stream-secret");
  });

  it("imports by link as signed-only media", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      result: { uid: "media-2", readyToStream: false, thumbnail: "https://thumb.test/image.jpg" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await importStreamFromUrl({
      sourceUrl: "https://signed-s3.test/master.mov?sig=one", filename: "master.mov", creatorId: "creator-hash", projectId: "project-1", versionId: "version-2",
    });
    expect(result).toMatchObject({ uid: "media-2", ready: false });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ input: "https://signed-s3.test/master.mov?sig=one", requireSignedURLs: true });
  });

  it("surfaces encoding progress and terminal errors to Video Room", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      result: { uid: "media-3", readyToStream: false, status: { state: "error", pctComplete: "67", errorReasonCode: "ERR_NON_VIDEO", errorReasonText: "Invalid input" } },
    }), { status: 200, headers: { "content-type": "application/json" } })));
    await expect(getStreamVideoStatus("media-3")).resolves.toMatchObject({
      ready: false, state: "error", progressPercent: 67, error: "ERR_NON_VIDEO: Invalid input",
    });
  });
});
