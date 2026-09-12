import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_EXTERNAL_TIMEOUT_MS,
  callExternalApi,
  externalFetch,
} from "./external-api.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("externalFetch", () => {
  it("attaches a default timeout signal when none is given", async () => {
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return jsonResponse({});
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await externalFetch("https://googleads.googleapis.com/v18/x");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("respects a caller-supplied signal", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      return jsonResponse({});
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await externalFetch("https://example.com", { signal: controller.signal });
  });

  it("exposes the same default timeout as the Places template (12s)", () => {
    expect(DEFAULT_EXTERNAL_TIMEOUT_MS).toBe(12_000);
  });
});

describe("callExternalApi", () => {
  it("returns typed data on 2xx", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ hello: "verden" })) as unknown as typeof fetch;
    const result = await callExternalApi<{ hello: string }>("https://example.com/api");
    expect(result).toEqual({ ok: true, status: 200, data: { hello: "verden" } });
  });

  it("returns a failure (never throws) on 4xx without retrying", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "nope" }, 403));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await callExternalApi("https://example.com/api", { retries: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe("http_403");
    }
    expect(fetchMock).toHaveBeenCalledTimes(1); // 403 er ikke retryable
  });

  it("retries on 5xx and succeeds on a later attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({ ok: 1 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await callExternalApi("https://example.com/api", {
      retries: 1,
      retryDelayMs: 1,
    });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("flags timeouts distinctly from other network errors", async () => {
    const timeoutErr = new Error("operation timed out");
    timeoutErr.name = "TimeoutError";
    globalThis.fetch = vi.fn(async () => {
      throw timeoutErr;
    }) as unknown as typeof fetch;

    const result = await callExternalApi("https://example.com/api");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.timedOut).toBe(true);
      expect(result.error).toBe("timeout");
    }
  });

  it("returns network_error on plain fetch rejections", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const result = await callExternalApi("https://example.com/api");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.timedOut).toBe(false);
      expect(result.error).toBe("network_error");
    }
  });
});
