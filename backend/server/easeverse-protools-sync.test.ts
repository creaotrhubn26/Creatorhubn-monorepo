import { afterEach, describe, expect, it, vi } from "vitest";
import { pushApprovedReferenceMixToEaseVerse, pushProToolsSyncToEaseVerse } from "./easeverse-protools-sync.js";

describe("pushProToolsSyncToEaseVerse", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("does not call the network when the production bridge is not fully configured", async () => {
    const fetchImpl = vi.fn();
    const result = await pushProToolsSyncToEaseVerse(
      { externalTrackId: "track-1", markers: [] },
      { apiUrl: "", apiKey: "", fetchImpl: fetchImpl as typeof fetch },
    );

    expect(result).toEqual({ configured: false, synced: false, reason: "missing_api_url" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts the canonical Companion snapshot with external-key auth", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, storage: "postgres" }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));

    const result = await pushProToolsSyncToEaseVerse({
      externalTrackId: "track-1",
      projectId: "sound-room-1",
      bpm: 127.6,
      markers: [{ name: "Chorus", startSeconds: 32, endSeconds: 48 }],
      updatedAt: "2026-09-06T19:00:00.000Z",
    }, {
      apiUrl: "https://easeverse.netlify.app/",
      apiKey: "test-key",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result).toEqual({ configured: true, synced: true, status: 200, storage: "postgres" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://easeverse.netlify.app/api/v1/collab/protools");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "content-type": "application/json", "x-api-key": "test-key" });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      schemaVersion: 1,
      externalTrackId: "track-1",
      projectId: "sound-room-1",
      integrationContext: { audioReviewProjectId: "sound-room-1" },
      source: "creatorhub-protools-companion",
      bpm: 128,
      markers: [{ id: "marker-1", label: "Chorus", positionMs: 32000, endPositionMs: 48000 }],
      takeScores: [],
      pronunciationFeedback: [],
    });
  });

  it("reports an external HTTP failure without throwing", async () => {
    const fetchImpl = vi.fn(async () => new Response("unauthorized", { status: 401 }));
    const result = await pushProToolsSyncToEaseVerse(
      { externalTrackId: "track-1", markers: [] },
      { apiUrl: "https://easeverse.netlify.app", apiKey: "wrong-key", fetchImpl: fetchImpl as typeof fetch },
    );

    expect(result).toEqual({ configured: true, synced: false, status: 401, reason: "http_error" });
  });

  it("pushes an approved mix as the linked EaseVerse reference track", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const result = await pushApprovedReferenceMixToEaseVerse({
      ownerUserId: "user-1",
      externalTrackId: "track-1",
      url: "https://audio.example.test/mix.wav",
      name: "Mix V3.wav",
      durationSec: 182.5,
    }, { apiUrl: "https://easeverse.netlify.app", apiKey: "test-key", fetchImpl: fetchImpl as typeof fetch });
    expect(result.synced).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://easeverse.netlify.app/api/v1/collab/reference");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      schemaVersion: 1,
      ownerUserId: "user-1",
      externalTrackId: "track-1",
      url: "https://audio.example.test/mix.wav",
      name: "Mix V3.wav",
      durationSec: 182.5,
    });
  });

  it("rejects a non-HTTPS approved reference before making a request", async () => {
    const fetchImpl = vi.fn();
    const result = await pushApprovedReferenceMixToEaseVerse({
      ownerUserId: "user-1", externalTrackId: "track-1", url: "http://audio.example.test/mix.wav",
    }, { apiUrl: "https://easeverse.netlify.app", apiKey: "test-key", fetchImpl: fetchImpl as typeof fetch });
    expect(result).toMatchObject({ configured: true, synced: false, reason: "invalid_audio_url" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
