import dns from "node:dns";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isPrivateAddress,
  ssrfSafeDispatcher,
  ssrfSafeFetchWithMetadata,
  ssrfSafeLookup,
} from "./ssrf-guard.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("shared SSRF guard", () => {
  it("rejects dotted and hexadecimal IPv4-mapped IPv6 private addresses", () => {
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:7f00:1")).toBe(true);
    expect(isPrivateAddress("::127.0.0.1")).toBe(true);
    expect(isPrivateAddress("::7f00:1")).toBe(true);
    expect(isPrivateAddress("0:0:0:0:0:0:127.0.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:5db8:d822")).toBe(false);
    expect(isPrivateAddress("::5db8:d822")).toBe(false);
  });

  it("binds the guarded dispatcher and request budget hook to every redirect hop", async () => {
    vi.spyOn(dns.promises, "lookup").mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ]);
    const redirectCancelled = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new ReadableStream({ cancel: redirectCancelled }), {
          status: 302,
          headers: { Location: "https://redirect.example/final" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const beforeRequest = vi.fn();

    const result = await ssrfSafeFetchWithMetadata(
      "https://origin.example/start",
      {},
      3,
      beforeRequest,
    );

    expect(result).toMatchObject({
      finalUrl: "https://redirect.example/final",
      redirectCount: 1,
      requestCount: 2,
    });
    expect(beforeRequest.mock.calls).toEqual([
      ["https://origin.example/start", 0],
      ["https://redirect.example/final", 1],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(redirectCancelled).toHaveBeenCalledOnce();
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({
        redirect: "manual",
        dispatcher: ssrfSafeDispatcher,
      });
    }
  });

  it("blocks a redirect to a private literal before a second request", async () => {
    vi.spyOn(dns.promises, "lookup").mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "http://127.0.0.1/admin" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      ssrfSafeFetchWithMetadata("https://origin.example/start"),
    ).rejects.toThrow("SSRF: intern adresse ikke tillatt");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a private DNS result in the lookup used by the actual socket", async () => {
    vi.spyOn(dns, "lookup").mockImplementation(
      (_hostname: string, _options: unknown, callback: unknown) => {
        (callback as (error: Error | null, addresses: unknown) => void)(null, [
          { address: "169.254.169.254", family: 4 },
        ]);
        return undefined as never;
      },
    );

    await expect(
      new Promise((resolve, reject) => {
        (ssrfSafeLookup as unknown as Function)(
          "rebinding.example",
          { all: false },
          (error: Error | null, address: string) =>
            error ? reject(error) : resolve(address),
        );
      }),
    ).rejects.toThrow("SSRF: resolved to a private address");
  });
});
