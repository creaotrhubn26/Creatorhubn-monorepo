import { describe, expect, it } from "vitest";

import { latestPostAgentTag, manifestUrlForTag, fetchUpdateManifest } from "./post-agent-update-manifest.js";

describe("latestPostAgentTag", () => {
  it("velger nyeste post-agent-tag (semver), ignorerer andre produkter + draft/prerelease", () => {
    const releases = [
      { tag_name: "protools-companion-v0.9.0" },
      { tag_name: "post-agent-v0.3.9" },
      { tag_name: "post-agent-v0.3.17" },
      { tag_name: "post-agent-v0.3.16" },
      { tag_name: "post-agent-v0.4.0", draft: true },
      { tag_name: "post-agent-v0.3.18", prerelease: true },
    ];
    expect(latestPostAgentTag(releases)).toBe("post-agent-v0.3.17");
  });
  it("semver-sortering (ikke leksikalsk: v0.3.10 > v0.3.9)", () => {
    expect(latestPostAgentTag([{ tag_name: "post-agent-v0.3.9" }, { tag_name: "post-agent-v0.3.10" }])).toBe("post-agent-v0.3.10");
  });
  it("ingen post-agent-tag → null", () => {
    expect(latestPostAgentTag([{ tag_name: "one-desk-v1.0.0" }])).toBeNull();
    expect(latestPostAgentTag(null)).toBeNull();
  });
});

describe("fetchUpdateManifest", () => {
  // fetcher: API-kall → releases-liste; deretter manifest-kall.
  const mk = (releasesJson: string, manifestOk: boolean, manifestBody: string) => {
    return async (url: string) => {
      if (url.includes("api.github.com")) return { ok: true, status: 200, text: async () => releasesJson };
      return { ok: manifestOk, status: manifestOk ? 200 : 404, text: async () => manifestBody };
    };
  };

  it("henter manifest for nyeste post-agent-tag fra API-et", async () => {
    const releases = JSON.stringify([{ tag_name: "post-agent-v0.3.16" }, { tag_name: "post-agent-v0.3.17" }]);
    const r = await fetchUpdateManifest("darwin-aarch64", mk(releases, true, '{"version":"0.3.17","platforms":{}}'));
    expect(r).toEqual({ ok: true, body: '{"version":"0.3.17","platforms":{}}' });
  });
  it("faller til /latest/ når API-et feiler", async () => {
    const fetcher = async (url: string) => {
      if (url.includes("api.github.com")) return { ok: false, status: 500, text: async () => "" };
      expect(url).toContain("/releases/latest/download/");
      return { ok: true, status: 200, text: async () => '{"version":"0.3.17"}' };
    };
    const r = await fetchUpdateManifest("darwin-aarch64", fetcher);
    expect(r).toEqual({ ok: true, body: '{"version":"0.3.17"}' });
  });
  it("manifest 404 → 502-feil", async () => {
    const r = await fetchUpdateManifest("darwin-aarch64", mk("[]", false, ""));
    expect(r).toEqual({ ok: false, status: 502, error: "manifest_utilgjengelig_404" });
  });
  it("ugyldig key → 400", async () => {
    const r = await fetchUpdateManifest("linux-x64", mk("[]", true, '{"version":"x"}'));
    expect(r).toEqual({ ok: false, status: 400, error: "ugyldig_target" });
  });
  it("manifestUrlForTag bygger riktig URL", () => {
    expect(manifestUrlForTag("post-agent-v0.3.17", "darwin-aarch64")).toContain("/releases/download/post-agent-v0.3.17/post-agent-darwin-aarch64.json");
  });
});
