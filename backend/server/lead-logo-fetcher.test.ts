import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchBestLogo } from "./lead-logo-fetcher.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Leadgrid logo fetcher safety and budgets", () => {
  it("rejects private targets without making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchBestLogo("http://127.0.0.1/admin"))
      .rejects.toThrow("unsafe_website_url");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks no more than five discovered candidates in parallel", async () => {
    const icons = Array.from(
      { length: 12 },
      (_, index) => `<link rel="icon" href="/icon-${index}.png">`,
    ).join("");
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") return new Response(null, { status: 200 });
      return new Response(`<html><head>${icons}</head></html>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBestLogo("https://dentum.example");

    expect(result?.url).toBe("https://dentum.example/icon-0.png");
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "HEAD"))
      .toHaveLength(5);
  });
});
