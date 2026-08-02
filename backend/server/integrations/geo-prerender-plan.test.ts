import { describe, expect, it } from "vitest";

import {
  buildGeoPrerenderPlan,
  buildRobotsLines,
  detectPlatform,
  prioritizePages,
} from "./geo-prerender-plan.js";

describe("prioritizePages", () => {
  it("rot først, innholdssider boostes, støy og fremmede hoster filtreres", () => {
    const pages = prioritizePages("medside.no", [
      "https://medside.no/personvern",
      "https://medside.no/blogg/artikkel-1",
      "https://medside.no/tjenester",
      "https://andre.no/side",
      "https://medside.no/a/b/c/d/dyp-side",
      "https://www.medside.no/priser",
    ]);
    expect(pages[0]).toBe("https://medside.no/");
    expect(pages).not.toContain("https://medside.no/personvern");
    expect(pages).not.toContain("https://andre.no/side");
    expect(pages).toContain("https://www.medside.no/priser"); // www = samme domene
    expect(pages.indexOf("https://medside.no/tjenester")).toBeLessThan(pages.indexOf("https://medside.no/a/b/c/d/dyp-side"));
  });
});

describe("buildGeoPrerenderPlan", () => {
  const base = {
    domain: "https://medside.no",
    sitemapPages: ["https://medside.no/tjenester"],
  };

  it("manglende bot-serving → full tiltaksliste m/ plattform-oppskrift og /-fella", () => {
    const plan = buildGeoPrerenderPlan({
      ...base,
      platform: "vercel",
      capabilities: [
        { key: "bot_serving", status: "missing", details: "SPA-skall" },
        { key: "sitemap", status: "implemented" },
        { key: "robots_ai", status: "implemented" },
      ],
    });
    expect(plan.situation).toContain("usynlig");
    expect(plan.actions.some((a) => a.includes("Prerender"))).toBe(true);
    expect(plan.actions.some((a) => a.includes("IndexNow"))).toBe(true);
    expect(plan.servingRecipe).toContain("KAN IKKE rewrites"); // fella dokumentert
    expect(plan.robotsLines).toContain("User-agent: GPTBot");
    expect(plan.jsonLdTemplate).toContain('"@type": "Article"');
    expect(plan.jsonLdTemplate).toContain("https://medside.no");
  });

  it("robots-blokkering løftes til første tiltak; hostet-hos-oss er konfigjobb", () => {
    const plan = buildGeoPrerenderPlan({
      ...base,
      platform: "hosted_by_us",
      capabilities: [
        { key: "robots_ai", status: "missing", details: "Blokkerte boter: GPTBot" },
        { key: "bot_serving", status: "missing" },
      ],
    });
    expect(plan.actions[0]).toContain("robots-blokkeringen");
    expect(plan.servingRecipe).toContain("KONFIGURASJONSJOBB");
  });

  it("allerede implementert → vedlikeholds-tone, ikke førstegangsoppsett", () => {
    const plan = buildGeoPrerenderPlan({
      ...base,
      platform: "unknown",
      capabilities: [{ key: "bot_serving", status: "implemented", details: "bot 5000 tegn" }],
    });
    expect(plan.situation).toContain("vedlikehold");
    expect(plan.actions.some((a) => a.includes("Prerender sidene"))).toBe(false);
  });
});

describe("detectPlatform", () => {
  it("gjenkjenner Vercel/Netlify/nginx fra headere; ellers unknown", () => {
    expect(detectPlatform({ "x-vercel-id": "fra1:abc" })).toBe("vercel");
    expect(detectPlatform({ "x-nf-request-id": "xyz" })).toBe("netlify");
    expect(detectPlatform({ server: "nginx/1.24" })).toBe("nginx");
    expect(detectPlatform({ server: "cloudflare" })).toBe("unknown");
  });
});

describe("buildRobotsLines", () => {
  it("alle AI-boter + sitemap-deklarasjon", () => {
    const lines = buildRobotsLines("medside.no");
    for (const ua of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "bingbot"]) {
      expect(lines).toContain(`User-agent: ${ua}`);
    }
    expect(lines[lines.length - 1]).toBe("Sitemap: https://medside.no/sitemap.xml");
  });
});
