import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const oauthMocks = vi.hoisted(() => ({
  getAdsOauthConnection: vi.fn(),
  ensureFreshAdsToken: vi.fn(),
  isLinkedInMatchedAudiencesEnabled: vi.fn(),
}));

vi.mock("./role-room-ads-oauth.js", () => ({
  getAdsOauthConnection: oauthMocks.getAdsOauthConnection,
  ensureFreshAdsToken: oauthMocks.ensureFreshAdsToken,
  isLinkedInMatchedAudiencesEnabled:
    oauthMocks.isLinkedInMatchedAudiencesEnabled,
}));

import {
  createLinkedinMatchedAudience,
  syncLinkedinMatchedAudienceMembers,
} from "./client-linkedin-suite.js";
import { LINKEDIN_API_VERSION } from "./linkedin-api-version.js";

function poolStub() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
  };
}

function batchSuccessResponse() {
  return new Response(JSON.stringify({ elements: [{ status: 201 }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("client LinkedIn Matched Audiences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    oauthMocks.isLinkedInMatchedAudiencesEnabled.mockReturnValue(true);
    oauthMocks.getAdsOauthConnection.mockResolvedValue({ id: "connection-1" });
    oauthMocks.ensureFreshAdsToken.mockResolvedValue({
      connectionState: "connected",
      accessToken: "linkedin-access-token",
      scopes: ["r_ads", "rw_dmp_segments"],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses the verified create and batch-user contract", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 201,
        headers: { "x-restli-id": "10804" },
      }))
      .mockResolvedValueOnce(batchSuccessResponse());
    vi.stubGlobal("fetch", fetchMock);
    const pool = poolStub();

    const resultPromise = createLinkedinMatchedAudience(pool as never, {
      producerUserId: "producer-1",
      adAccountUrn: "urn:li:sponsoredAccount:123",
      name: "CreatorHub audience",
      sourceDescription: "Approved CRM audience",
      identifiers: [
        { email: " Person@Example.Test " },
        { email: "person@example.test" },
        { phone: "+4712345678" },
      ],
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    const result = await resultPromise;

    expect(result).toEqual({
      ok: true,
      segmentUrn: "urn:li:dmpSegment:10804",
      uploadCount: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [createUrl, createInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const createPayload = JSON.parse(String(createInit.body)) as Record<string, unknown>;
    const createHeaders = createInit.headers as Record<string, string>;
    expect(createUrl).toBe("https://api.linkedin.com/rest/dmpSegments");
    expect(createPayload).toMatchObject({
      sourcePlatform: "PARTNER_API",
      type: "USER",
      account: "urn:li:sponsoredAccount:123",
      description: "Approved CRM audience",
    });
    expect(createHeaders["LinkedIn-Version"]).toBe(LINKEDIN_API_VERSION);
    expect(createHeaders["LinkedIn-Version"]).not.toBe("202410");

    const [uploadUrl, uploadInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const uploadPayload = JSON.parse(String(uploadInit.body)) as {
      elements: Array<Record<string, unknown>>;
    };
    const uploadHeaders = uploadInit.headers as Record<string, string>;
    const expectedHash = createHash("sha256")
      .update("person@example.test")
      .digest("hex");
    expect(uploadUrl).toBe("https://api.linkedin.com/rest/dmpSegments/10804/users");
    expect(uploadHeaders["X-RestLi-Method"]).toBe("BATCH_CREATE");
    expect(uploadPayload.elements).toEqual([{
      action: "ADD",
      userIds: [{ idType: "SHA256_EMAIL", idValue: expectedHash }],
    }]);
    expect(JSON.stringify(uploadPayload)).not.toContain("Person@Example.Test");
    expect(JSON.stringify(uploadPayload)).not.toContain("+4712345678");
    expect(pool.query).toHaveBeenCalledOnce();
  });

  it("fails closed before provider calls when rw_dmp_segments is missing", async () => {
    oauthMocks.ensureFreshAdsToken.mockResolvedValue({
      connectionState: "connected",
      accessToken: "linkedin-access-token",
      scopes: ["r_ads"],
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await createLinkedinMatchedAudience(poolStub() as never, {
      producerUserId: "producer-1",
      adAccountUrn: "urn:li:sponsoredAccount:123",
      name: "CreatorHub audience",
      identifiers: [{ email: "person@example.test" }],
    });

    expect(result).toEqual({ ok: false, error: "missing_rw_dmp_segments" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed before OAuth or provider calls when the feature flag is off", async () => {
    oauthMocks.isLinkedInMatchedAudiencesEnabled.mockReturnValue(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await createLinkedinMatchedAudience(poolStub() as never, {
      producerUserId: "producer-1",
      adAccountUrn: "urn:li:sponsoredAccount:123",
      name: "CreatorHub audience",
      identifiers: [{ email: "person@example.test" }],
    });

    expect(result).toEqual({
      ok: false,
      error: "matched_audiences_disabled",
    });
    expect(oauthMocks.getAdsOauthConnection).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not create an orphan segment for phone-only identifiers", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await createLinkedinMatchedAudience(poolStub() as never, {
      producerUserId: "producer-1",
      adAccountUrn: "urn:li:sponsoredAccount:123",
      name: "CreatorHub audience",
      identifiers: [{ phone: "+4712345678" }],
    });

    expect(result).toEqual({
      ok: false,
      error: "Ingen gyldige e-postidentifikatorer",
    });
    expect(oauthMocks.getAdsOauthConnection).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a rejected batch and does not cache it as successful", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 201,
        headers: { "x-restli-id": "10804" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        elements: [{ status: 400, error: { message: "invalid" } }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const pool = poolStub();

    const resultPromise = createLinkedinMatchedAudience(pool as never, {
      producerUserId: "producer-1",
      adAccountUrn: "urn:li:sponsoredAccount:123",
      name: "CreatorHub audience",
      identifiers: [{ email: "person@example.test" }],
    });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      error: "dmpUsers batch_rejected",
      segmentUrn: "urn:li:dmpSegment:10804",
    });
    expect(pool.query).toHaveBeenCalledOnce();
    expect(String(pool.query.mock.calls[0]?.[0])).toContain(
      "ON CONFLICT (linkedin_segment_urn) DO UPDATE",
    );
    expect(pool.query.mock.calls[0]?.[1]).toEqual([
      null,
      "producer-1",
      "urn:li:sponsoredAccount:123",
      "urn:li:dmpSegment:10804",
      "CreatorHub audience",
      null,
      0,
      "failed",
    ]);
  });

  it.each([
    ["empty", ""],
    ["malformed", "not-json"],
    ["missing elements", JSON.stringify({})],
    ["wrong element count", JSON.stringify({ elements: [] })],
    ["unexpected status", JSON.stringify({ elements: [{ status: 200 }] })],
  ])("fails closed for a %s successful batch response", async (_name, raw) => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 201,
        headers: { "x-restli-id": "10804" },
      }))
      .mockResolvedValueOnce(new Response(raw, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const pool = poolStub();

    const resultPromise = createLinkedinMatchedAudience(pool as never, {
      producerUserId: "producer-1",
      adAccountUrn: "urn:li:sponsoredAccount:123",
      name: "CreatorHub audience",
      identifiers: [{ email: "person@example.test" }],
    });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      error: "dmpUsers batch_rejected",
      segmentUrn: "urn:li:dmpSegment:10804",
    });
    expect(pool.query).toHaveBeenCalledOnce();
    expect(pool.query.mock.calls[0]?.[1]?.[7]).toBe("failed");
  });

  it("returns the segment id when both upload and failed-state persistence fail", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 201,
        headers: { "x-restli-id": "10804" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        elements: [{ status: 400, error: { message: "invalid" } }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const pool = {
      query: vi.fn().mockRejectedValue(new Error("database unavailable")),
    };

    const resultPromise = createLinkedinMatchedAudience(pool as never, {
      producerUserId: "producer-1",
      adAccountUrn: "urn:li:sponsoredAccount:123",
      name: "CreatorHub audience",
      identifiers: [{ email: "person@example.test" }],
    });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      error: "audience_persistence_failed",
      segmentUrn: "urn:li:dmpSegment:10804",
    });
  });

  it("reports a traceable failure when the uploaded audience cannot be persisted", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 201,
        headers: { "x-restli-id": "10804" },
      }))
      .mockResolvedValueOnce(batchSuccessResponse());
    vi.stubGlobal("fetch", fetchMock);
    const pool = {
      query: vi.fn().mockRejectedValue(new Error("database unavailable")),
    };

    const resultPromise = createLinkedinMatchedAudience(pool as never, {
      producerUserId: "producer-1",
      adAccountUrn: "urn:li:sponsoredAccount:123",
      name: "CreatorHub audience",
      identifiers: [{ email: "person@example.test" }],
    });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      error: "audience_persistence_failed",
      segmentUrn: "urn:li:dmpSegment:10804",
    });
  });

  it("syncs an existing URN through its numeric segment id", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(batchSuccessResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncLinkedinMatchedAudienceMembers(poolStub() as never, {
      producerUserId: "producer-1",
      segmentUrn: "urn:li:dmpSegment:10804",
      identifiers: [{ email: "person@example.test" }],
    });

    expect(result).toEqual({ ok: true, uploadCount: 1 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.linkedin.com/rest/dmpSegments/10804/users",
    );
  });

  it("rejects an invalid stored segment URN before provider calls", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncLinkedinMatchedAudienceMembers(poolStub() as never, {
      producerUserId: "producer-1",
      segmentUrn: "urn:li:dmpSegment:not-a-number",
      identifiers: [{ email: "person@example.test" }],
    });

    expect(result).toEqual({ ok: false, error: "invalid_segment_urn" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
