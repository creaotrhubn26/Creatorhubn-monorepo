import { describe, expect, it } from "vitest";

import { buildVerificationMetaTag, runGscSetup, type GscFetcher } from "./role-room-agent-gsc-setup.js";

function fakeFetcher(routes: Array<[RegExp, string, { status: number; json?: unknown }]>): { fetcher: GscFetcher; calls: Array<{ url: string; method: string }> } {
  const calls: Array<{ url: string; method: string }> = [];
  const fetcher: GscFetcher = async (url, init) => {
    calls.push({ url, method: init.method });
    for (const [pattern, method, res] of routes) {
      if (method === init.method && pattern.test(url)) return { status: res.status, json: res.json ?? {} };
    }
    return { status: 404, json: {} };
  };
  return { fetcher, calls };
}

describe("runGscSetup", () => {
  it("allerede verifisert → rett til site-add + sitemap-innmelding", async () => {
    const { fetcher, calls } = fakeFetcher([
      [/webResource\/https/, "GET", { status: 200 }],
      [/webmasters\/v3\/sites\/[^/]+$/, "PUT", { status: 204 }],
      [/sitemaps/, "PUT", { status: 200 }],
    ]);
    const outcome = await runGscSetup({ accessToken: "t", domain: "medside.no", fetcher });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result).toMatchObject({
      verification: "already_verified",
      siteAdded: true,
      sitemapSubmitted: true,
      sitemapUrl: "https://medside.no/sitemap.xml",
    });
    expect(calls.some((c) => c.url.includes("sitemaps"))).toBe(true);
  });

  it("uverifisert uten deployet tag → pending m/ metataggen som skal ut", async () => {
    const { fetcher } = fakeFetcher([
      [/webResource\/https/, "GET", { status: 404 }],
      [/\/token$/, "POST", { status: 200, json: { token: "abc123xyz" } }],
      [/webResource\?verificationMethod=META/, "POST", { status: 400 }],
    ]);
    const outcome = await runGscSetup({ accessToken: "t", domain: "medside.no", fetcher });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.verification).toBe("pending");
    expect(outcome.result.verificationMetaTag).toBe(buildVerificationMetaTag("abc123xyz"));
    expect(outcome.result.sitemapSubmitted).toBe(false);
    expect(outcome.result.warnings[0]).toContain("<head>");
  });

  it("tag deployet → verified_now og full kjede; egen sitemap-URL respekteres", async () => {
    const { fetcher } = fakeFetcher([
      [/webResource\/https/, "GET", { status: 404 }],
      [/\/token$/, "POST", { status: 200, json: { token: "abc" } }],
      [/webResource\?verificationMethod=META/, "POST", { status: 200 }],
      [/webmasters\/v3\/sites\/[^/]+$/, "PUT", { status: 204 }],
      [/sitemaps/, "PUT", { status: 204 }],
    ]);
    const outcome = await runGscSetup({ accessToken: "t", domain: "medside.no", sitemapUrl: "https://medside.no/kart.xml", fetcher });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.verification).toBe("verified_now");
    expect(outcome.result.sitemapUrl).toBe("https://medside.no/kart.xml");
    expect(outcome.result.sitemapSubmitted).toBe(true);
  });

  it("403 → needsReauth; sitemap-feil blir advarsel, ikke velt", async () => {
    const denied = fakeFetcher([[/webResource\/https/, "GET", { status: 403 }]]);
    expect(await runGscSetup({ accessToken: "t", domain: "medside.no", fetcher: denied.fetcher })).toMatchObject({ ok: false, needsReauth: true });

    const smFail = fakeFetcher([
      [/webResource\/https/, "GET", { status: 200 }],
      [/webmasters\/v3\/sites\/[^/]+$/, "PUT", { status: 204 }],
      [/sitemaps/, "PUT", { status: 500 }],
    ]);
    const outcome = await runGscSetup({ accessToken: "t", domain: "medside.no", fetcher: smFail.fetcher });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.sitemapSubmitted).toBe(false);
    expect(outcome.result.warnings.some((w) => w.includes("Sitemap-innmelding"))).toBe(true);
  });
});
