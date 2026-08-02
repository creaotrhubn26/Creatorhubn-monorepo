import { describe, expect, it } from "vitest";

import {
  compareBotServing,
  extractVisibleText,
  parseAnalyticsTags,
  parseRobots,
  runSiteSetupAudit,
  validateAuditUrl,
  type AuditFetcher,
} from "./site-setup-audit.js";

describe("validateAuditUrl (SSRF-vern)", () => {
  it("godtar offentlige domener, normaliserer uten skjema", () => {
    const r = validateAuditUrl("klientdomene.no");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url.toString()).toBe("https://klientdomene.no/");
  });

  it("avviser private adresser, localhost, rare porter og credentials", () => {
    for (const bad of [
      "http://localhost/x", "http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1/",
      "http://172.16.0.9/", "http://169.254.1.1/", "http://backend.internal/", "http://foo.local/",
      "http://[::1]/", "https://a.no:8080/", "https://user:pass@a.no/", "ftp://a.no/", "http://singleword/",
    ]) {
      expect(validateAuditUrl(bad).ok, bad).toBe(false);
    }
  });
});

describe("parseAnalyticsTags", () => {
  it("finner GA4, GTM, Pixel, Clarity, CMP og GSC-metatag — vårt eget bootstrap-mønster", () => {
    const html = `
      <meta name="google-site-verification" content="abc123" />
      <script src="https://www.googletagmanager.com/gtag/js?id=G-3MS91ZHVKS"></script>
      <script>gtag('config','G-3MS91ZHVKS');</script>
      <script src="https://www.googletagmanager.com/gtm.js?id=GTM-W8QZL75L"></script>
      <script>fbq('init', '929515126829909');</script>
      <script src="https://www.clarity.ms/tag/xnzezvwkbm"></script>
      <script src="https://consent.cookiebot.com/uc.js"></script>`;
    const tags = parseAnalyticsTags(html);
    expect(tags.ga4).toEqual(["G-3MS91ZHVKS"]);
    expect(tags.gtm).toEqual(["GTM-W8QZL75L"]);
    expect(tags.metaPixel).toEqual(["929515126829909"]);
    expect(tags.clarity).toEqual(["xnzezvwkbm"]);
    expect(tags.cmp).toBe("Cookiebot");
    expect(tags.gscMetaTag).toBe(true);
  });

  it("tom HTML gir tomme lister — ingen gjetting", () => {
    const tags = parseAnalyticsTags("<html><body>Hei</body></html>");
    expect(tags.ga4).toEqual([]);
    expect(tags.cmp).toBeNull();
    expect(tags.gscMetaTag).toBe(false);
  });
});

describe("parseRobots", () => {
  it("egen bot-gruppe med Disallow: / = disallowed; øvrige arver default", () => {
    const info = parseRobots(`User-agent: *\nDisallow:\nSitemap: https://a.no/sitemap.xml\n\nUser-agent: GPTBot\nDisallow: /`);
    expect(info.bots.GPTBot).toBe("disallowed");
    expect(info.bots.ClaudeBot).toBe("default");
    expect(info.blocksAll).toBe(false);
    expect(info.sitemaps).toEqual(["https://a.no/sitemap.xml"]);
  });

  it("flere User-agent-linjer i samme gruppe deler direktiver", () => {
    const info = parseRobots(`User-agent: GPTBot\nUser-agent: PerplexityBot\nDisallow: /`);
    expect(info.bots.GPTBot).toBe("disallowed");
    expect(info.bots.PerplexityBot).toBe("disallowed");
  });

  it("null = robots mangler", () => {
    expect(parseRobots(null).exists).toBe(false);
  });
});

describe("compareBotServing", () => {
  const long = `<p>${"innhold ".repeat(400)}</p>`;
  const shell = `<div id="root"></div><script>app()</script>`;

  it("bot får rikere innhold → full_content (prerender-suksess)", () => {
    expect(compareBotServing(shell, long, 200).verdict).toBe("full_content");
  });

  it("identisk SPA-skall → same_as_human; 403 → blocked", () => {
    expect(compareBotServing(shell, shell, 200).verdict).toBe("same_as_human");
    expect(compareBotServing(long, long, 403).verdict).toBe("blocked");
  });

  it("extractVisibleText fjerner script/style/tags", () => {
    expect(extractVisibleText(`<style>a{}</style><script>x()</script><p>Hei &amp; hopp</p>`)).toBe("Hei hopp");
  });
});

describe("runSiteSetupAudit (fake fetcher)", () => {
  const richBot = `<article>${"tekst ".repeat(500)}</article>`;
  const spaShell = `<div id="root"></div><script src="https://www.googletagmanager.com/gtag/js?id=G-TESTID12"></script>`;

  const fetcher: AuditFetcher = async (url) => {
    if (url.endsWith("/robots.txt")) return { status: 200, text: "User-agent: *\nDisallow:\nSitemap: https://klient.no/map.xml" };
    if (url.endsWith("/map.xml")) return { status: 200, text: "<urlset><url><loc>https://klient.no/</loc><lastmod>2026-07-01</lastmod></url></urlset>" };
    return { status: 200, text: url.includes("?") ? spaShell : spaShell };
  };

  it("bygger komplett rapport med ærlige unknown-statuser", async () => {
    const r = await runSiteSetupAudit("klient.no", fetcher);
    expect("audit" in r).toBe(true);
    if (!("audit" in r)) return;
    const by = Object.fromEntries(r.audit.capabilities.map((c) => [c.key, c]));
    expect(by.ga4.status).toBe("implemented");
    expect(by.sitemap.status).toBe("implemented");
    expect(by.robots_ai.status).toBe("implemented");
    expect(by.meta_pixel.status).toBe("unknown"); // ikke i HTML ≠ mangler
    expect(by.gsc.status).toBe("unknown");
    // SPA-skall m/ lite tekst og identisk bot-svar → GEO mangler
    expect(by.bot_serving.status).toBe("missing");
    expect(r.audit.limitations.length).toBeGreaterThan(0);
  });

  it("bot-prerendering gjenkjennes som implemented", async () => {
    const f: AuditFetcher = async (url, ua) => {
      if (url.endsWith("/robots.txt")) return { status: 404, text: "" };
      if (url.endsWith("/sitemap.xml")) return { status: 404, text: "" };
      return { status: 200, text: ua.includes("GPTBot") ? richBot : spaShell };
    };
    const r = await runSiteSetupAudit("https://klient.no", f);
    if (!("audit" in r)) throw new Error("uventet feil");
    const bot = r.audit.capabilities.find((c) => c.key === "bot_serving")!;
    expect(bot.status).toBe("implemented");
    const sm = r.audit.capabilities.find((c) => c.key === "sitemap")!;
    expect(sm.status).toBe("missing");
  });

  it("ugyldig URL gir feil, ikke rapport", async () => {
    expect(await runSiteSetupAudit("http://localhost:3000", fetcher)).toEqual({ error: "kun_standardporter" });
  });
});
