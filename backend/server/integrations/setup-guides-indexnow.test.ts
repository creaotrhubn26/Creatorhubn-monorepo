import { describe, expect, it } from "vitest";

import { getSetupGuide, SETUP_GUIDES, tailorSetupGuides } from "./setup-guides.js";
import { buildIndexNowPayload, submitIndexNow } from "./indexnow.js";

describe("SETUP_GUIDES (F4 — strukturert fasit)", () => {
  it("alle guider har innloggings-forventning, steg og F1-verifisering", () => {
    expect(SETUP_GUIDES.length).toBeGreaterThanOrEqual(6);
    for (const g of SETUP_GUIDES) {
      expect(g.requiresLogin.length, g.key).toBeGreaterThan(10);
      expect(g.steps.length, g.key).toBeGreaterThanOrEqual(2);
      expect(g.verification, g.key).toContain("site-auditen");
      for (const s of g.steps) {
        expect(s.title.length, `${g.key}: ${s.title}`).toBeGreaterThan(3);
        expect(s.detail.length, `${g.key}: ${s.title}`).toBeGreaterThan(10);
      }
    }
  });

  it("lærdommene fra eget oppsett er bakt inn som advarsler", () => {
    expect(getSetupGuide("gsc")!.steps.some((s) => s.warning?.includes("ÉN Search Console-kobling"))).toBe(true);
    expect(getSetupGuide("ga4")!.steps.some((s) => s.warning?.includes("system-låst"))).toBe(true);
    expect(getSetupGuide("gtm")!.steps.some((s) => s.warning?.includes("publisert versjon"))).toBe(true);
    expect(getSetupGuide("meta_pixel")!.steps.some((s) => s.warning?.includes("SMS-verifisering"))).toBe(true);
    expect(getSetupGuide("clarity")!.steps.some((s) => s.warning?.includes("Oops"))).toBe(true);
    expect(getSetupGuide("finnes-ikke")).toBeNull();
  });
});

describe("buildIndexNowPayload (F6 — validering)", () => {
  const key = "a".repeat(32);

  it("normaliserer host, dedupliserer og bygger keyLocation", () => {
    const r = buildIndexNowPayload({
      host: "https://Leadgrid.no/",
      key,
      urls: ["https://leadgrid.no/akademi", "https://leadgrid.no/akademi", "https://www.leadgrid.no/priser"],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.host).toBe("leadgrid.no");
    expect(r.payload.keyLocation).toBe(`https://leadgrid.no/${key}.txt`);
    expect(r.payload.urlList).toHaveLength(2);
  });

  it("avviser feil host, http, ugyldig nøkkel og tom liste", () => {
    expect(buildIndexNowPayload({ host: "leadgrid.no", key, urls: ["https://andre.no/x"] })).toMatchObject({ ok: false, error: "feil_host: andre.no" });
    expect(buildIndexNowPayload({ host: "leadgrid.no", key, urls: ["http://leadgrid.no/x"] }).ok).toBe(false);
    expect(buildIndexNowPayload({ host: "leadgrid.no", key: "IKKE-HEX", urls: ["https://leadgrid.no/"] })).toMatchObject({ ok: false, error: "ugyldig_nokkel" });
    expect(buildIndexNowPayload({ host: "leadgrid.no", key, urls: [" ", ""] })).toMatchObject({ ok: false, error: "ingen_urler" });
    expect(buildIndexNowPayload({ host: "localhost", key, urls: ["https://localhost/x"] })).toMatchObject({ ok: false, error: "ugyldig_host" });
  });

  it("tak på 100 URL-er (IndexNow-grensen håndheves før innsending)", () => {
    const urls = Array.from({ length: 101 }, (_, i) => `https://leadgrid.no/side-${i}`);
    expect(buildIndexNowPayload({ host: "leadgrid.no", key, urls })).toMatchObject({ ok: false, error: "maks_100_urler" });
  });
});

describe("submitIndexNow (fake poster)", () => {
  const payload = buildIndexNowPayload({
    host: "leadgrid.no",
    key: "b".repeat(32),
    urls: ["https://leadgrid.no/akademi"],
  });
  if (!payload.ok) throw new Error("testoppsett feilet");

  it("200/202 er suksess; 403 forklarer nøkkelfil-problemet", async () => {
    expect((await submitIndexNow(payload.payload, async () => ({ ok: true, status: 200 }))).ok).toBe(true);
    const accepted = await submitIndexNow(payload.payload, async () => ({ ok: false, status: 202 }));
    expect(accepted.ok).toBe(true);
    expect(accepted.detail).toContain("asynkront");
    const denied = await submitIndexNow(payload.payload, async () => ({ ok: false, status: 403 }));
    expect(denied.ok).toBe(false);
    expect(denied.detail).toContain("keyLocation");
  });
});

describe("tailorSetupGuides (F4 — skreddersydd per bedrift)", () => {
  it("krysser guidene med audit-observasjonene og sorterer trengs-først", () => {
    const guides = tailorSetupGuides("https://medside.no", [
      { key: "ga4", status: "implemented", details: "Måle-ID funnet: G-ABC123" },
      { key: "meta_pixel", status: "partial", details: "Pixel lastes i initial HTML — fyrer trolig før samtykke." },
      { key: "gsc", status: "unknown" },
      { key: "sitemap", status: "missing" },
    ]);
    const by = Object.fromEntries(guides.map((g) => [g.key, g]));
    expect(by.ga4.relevance).toBe("verify");
    expect(by.ga4.observed).toContain("G-ABC123");
    expect(by.meta_pixel.relevance).toBe("fix");
    expect(by.gsc.relevance).toBe("check_account");
    expect(by.gtm.relevance).toBe("check_account"); // ingen observasjon = sjekk kontoen
    expect(by.bing.observed).toContain("Sitemap mangler");
    // Sortering: needed/fix før verify
    expect(guides.findIndex((g) => g.key === "meta_pixel")).toBeLessThan(guides.findIndex((g) => g.key === "ga4"));
  });

  it("fletter domenet inn i stegene (sitemap-URL, verifiseringsfil-rot)", () => {
    const guides = tailorSetupGuides("medside.no", [{ key: "gsc", status: "missing" }]);
    const gsc = guides.find((g) => g.key === "gsc")!;
    expect(gsc.relevance).toBe("needed");
    expect(gsc.steps.some((s) => s.detail.includes("https://medside.no/sitemap.xml"))).toBe(true);
    expect(gsc.steps.some((s) => s.detail.includes("roten av medside.no"))).toBe(true);
  });
});
