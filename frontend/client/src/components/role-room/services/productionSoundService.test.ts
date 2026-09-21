import { beforeEach, describe, expect, it, vi } from "vitest";
import { productionSoundService } from "./productionSoundService";
import type { ProductionSoundConflictError } from "./productionSoundService";

const operations = {
  dayStatus: "setup" as const,
  setup: {
    sampleRate: 48000 as const,
    bitDepth: 24 as const,
    timecodeMode: "free_run" as const,
  },
  tracks: [],
  takeReports: [],
  unmatchedRecordings: [],
  additionalRecordings: [],
  handoff: { status: "draft" as const },
  activity: [],
};

describe("productionSoundService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("saves through the scoped production-sound endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          productionDay: {
            id: "day/1",
            scenes: [],
            crew: [],
            props: [],
            soundVersion: 3,
          },
        }),
      }),
    );

    const result = await productionSoundService.save(
      "troll project",
      "day/1",
      2,
      operations,
    );
    expect(result.soundVersion).toBe(3);
    expect(fetch).toHaveBeenCalledWith(
      "/api/role-room/projects/troll%20project/production-days/day%2F1/production-sound",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ expectedVersion: 2, operations }),
      }),
    );
  });

  it("keeps the server production day on a conflict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          message: "Konflikt",
          productionDay: {
            id: "day-1",
            scenes: [],
            crew: [],
            props: [],
            soundVersion: 8,
          },
        }),
      }),
    );

    await expect(
      productionSoundService.save("troll", "day-1", 2, operations),
    ).rejects.toMatchObject({
      name: "ProductionSoundConflictError",
      productionDay: expect.objectContaining({ soundVersion: 8 }),
    } satisfies Partial<ProductionSoundConflictError>);
  });

  it("lists parsed recorder metadata from the scoped day", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          media: [
            {
              id: "media-1",
              projectId: "troll",
              productionDayId: "day-1",
              storageObjectId: "object-1",
              displayName: "TROLL_12A_003.wav",
              contentType: "audio/wav",
              sizeBytes: 24000,
              checksumSha256: "a".repeat(64),
              recorderMetadata: {
                container: "RIFF",
                channels: 2,
                sampleRate: 48000,
                byteRate: 288000,
                blockAlign: 6,
                bitDepth: 24,
                dataSizeBytes: 2880,
                durationSeconds: 0.01,
                ixml: { scene: "12A", take: "3", tracks: [] },
                warnings: [],
              },
              reconciliationStatus: "unmatched",
              createdAt: "2026-09-21T08:00:00Z",
            },
          ],
        }),
      }),
    );

    const result = await productionSoundService.listMedia("troll", "day-1");
    expect(result).toEqual([
      expect.objectContaining({
        id: "media-1",
        recorderMetadata: expect.objectContaining({
          ixml: expect.objectContaining({ scene: "12A", take: "3" }),
        }),
      }),
    ]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/role-room/projects/troll/production-days/day-1/production-sound/media",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("uploads a WAVE directly to the signed S3 URL before server completion", async () => {
    const media = {
      id: "media-1",
      projectId: "troll",
      productionDayId: "day-1",
      storageObjectId: "object-1",
      displayName: "TROLL_12A_003.wav",
      contentType: "audio/wav",
      sizeBytes: 4,
      checksumSha256: "a".repeat(64),
      recorderMetadata: {
        container: "RIFF" as const,
        audioFormat: 1,
        channels: 2,
        sampleRate: 48000,
        byteRate: 288000,
        blockAlign: 6,
        bitDepth: 24,
        dataSizeBytes: 4,
        durationSeconds: 0.0001,
        warnings: [],
      },
      reconciliationStatus: "unmatched" as const,
      createdAt: "2026-09-21T08:00:00Z",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/initiate")) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            upload: {
              objectId: "object-1",
              strategy: "single",
              uploadUrl: "https://s3.example/signed",
              requiredHeaders: {
                "content-type": "audio/wav",
                "x-amz-checksum-sha256": "checksum",
              },
            },
          }),
        } as Response;
      }
      if (url.endsWith("/object-1/complete")) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ media }),
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    class FakeXmlHttpRequest {
      static instances: FakeXmlHttpRequest[] = [];
      upload: { onprogress: ((event: { loaded: number }) => void) | null } = {
        onprogress: null,
      };
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      status = 200;
      url = "";
      headers: Record<string, string> = {};
      body?: Blob;
      constructor() {
        FakeXmlHttpRequest.instances.push(this);
      }
      open(_method: string, url: string) {
        this.url = url;
      }
      setRequestHeader(name: string, value: string) {
        this.headers[name] = value;
      }
      getResponseHeader(name: string) {
        return name === "ETag" ? '"etag-1"' : null;
      }
      send(body: Blob) {
        this.body = body;
        this.upload.onprogress?.({ loaded: body.size });
        this.onload?.();
      }
    }
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("XMLHttpRequest", FakeXmlHttpRequest);
    const progress: number[] = [];
    const file = new File([new Uint8Array([1, 2, 3, 4])], "TROLL_12A_003.wav", {
      type: "audio/wav",
      lastModified: 1,
    });

    await expect(
      productionSoundService.uploadRecorderFile(
        "troll",
        "day-1",
        file,
        (value) => progress.push(value),
      ),
    ).resolves.toEqual(media);
    expect(FakeXmlHttpRequest.instances).toHaveLength(1);
    expect(FakeXmlHttpRequest.instances[0]).toMatchObject({
      url: "https://s3.example/signed",
      headers: expect.objectContaining({ "content-type": "audio/wav" }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(progress.at(-1)).toBe(100);
    expect(localStorage.length).toBe(0);
  });

  it("returns the canonical server day when reconciliation conflicts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          message: "Take-grunnlaget er endret.",
          productionDay: {
            id: "day-1",
            scenes: [],
            crew: [],
            props: [],
            soundVersion: 9,
          },
        }),
      }),
    );

    await expect(
      productionSoundService.reconcileMedia(
        "troll",
        "day-1",
        "media-1",
        8,
        "take-1",
      ),
    ).rejects.toMatchObject({
      name: "ProductionSoundConflictError",
      productionDay: expect.objectContaining({ soundVersion: 9 }),
    });
  });
});
