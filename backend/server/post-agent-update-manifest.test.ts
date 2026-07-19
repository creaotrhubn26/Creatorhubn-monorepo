import { describe, expect, it } from "vitest";

import { updateManifestUrl, fetchUpdateManifest } from "./post-agent-update-manifest.js";

describe("updateManifestUrl", () => {
  it("tag-basert URL når versjon er kjent (robust)", () => {
    expect(updateManifestUrl("darwin-aarch64", "0.3.16")).toContain("/releases/download/post-agent-v0.3.16/post-agent-darwin-aarch64.json");
    expect(updateManifestUrl("darwin-x86_64", "v0.3.16")).toContain("post-agent-v0.3.16/post-agent-darwin-x86_64.json");
  });
  it("faller til /latest/ uten versjon", () => {
    expect(updateManifestUrl("darwin-aarch64", null)).toContain("/releases/latest/download/post-agent-darwin-aarch64.json");
    expect(updateManifestUrl("darwin-aarch64", "rar")).toContain("/releases/latest/download/");
  });
  it("ugyldig target-key → null", () => {
    expect(updateManifestUrl("linux-x64", "0.3.16")).toBeNull();
    expect(updateManifestUrl("../etc", "0.3.16")).toBeNull();
  });
});

describe("fetchUpdateManifest", () => {
  const mockFetch = (ok: boolean, status: number, body: string) =>
    async () => ({ ok, status, text: async () => body });

  it("gyldig manifest → { ok, body }", async () => {
    const r = await fetchUpdateManifest("darwin-aarch64", "0.3.16", mockFetch(true, 200, '{"version":"0.3.16","platforms":{}}'));
    expect(r).toEqual({ ok: true, body: '{"version":"0.3.16","platforms":{}}' });
  });
  it("404 → feil", async () => {
    const r = await fetchUpdateManifest("darwin-aarch64", "0.3.16", mockFetch(false, 404, ""));
    expect(r).toEqual({ ok: false, status: 502, error: "manifest_utilgjengelig_404" });
  });
  it("respons uten \"version\" → ugyldig_manifest", async () => {
    const r = await fetchUpdateManifest("darwin-aarch64", "0.3.16", mockFetch(true, 200, "<html>404</html>"));
    expect(r).toEqual({ ok: false, status: 502, error: "ugyldig_manifest" });
  });
  it("ugyldig key → 400", async () => {
    const r = await fetchUpdateManifest("bad", "0.3.16", mockFetch(true, 200, '{"version":"x"}'));
    expect(r).toEqual({ ok: false, status: 400, error: "ugyldig_target" });
  });
});
