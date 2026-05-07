import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  analyzeWebsite,
  parseStaticSignals,
  hashUrl,
  normalizeUrl,
  __setWebsiteAnalyzerHttp,
  __setWebsiteAnalyzerAnthropic,
} from "./role-room-website-analyzer.js";

const HOLY_CRUST_HTML = `
<!doctype html>
<html lang="no">
<head>
  <title>Holy Crust — Surdeigsbakeri i Oslo</title>
  <meta name="description" content="Håndlaget surdeigsbrød og pizza fra Oslo. Bestill online eller besøk oss." />
  <meta property="og:site_name" content="Holy Crust" />
  <meta property="og:title" content="Holy Crust — Surdeigsbakeri i Oslo" />
  <meta property="og:image" content="https://holycrust.no/logo.png" />
  <meta name="theme-color" content="#8b3a1f" />
  <link rel="icon" href="/favicon.ico" />
  <style>
    :root {
      --primary-color: #8b3a1f;
      --secondary-color: #d4a574;
      --accent: #f4e8d0;
    }
    body { font-family: 'Inter', sans-serif; }
    h1 { font-family: 'Playfair Display', serif; }
  </style>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "name": "Holy Crust",
    "menu": "https://holycrust.no/menu"
  }
  </script>
</head>
<body>
  <header>
    <img src="/logo.png" alt="Holy Crust logo" />
    <nav>
      <a href="/menu">Meny</a>
      <a href="/locations">Lokasjoner</a>
      <a href="/blog">Blogg</a>
      <a href="/contact">Kontakt</a>
    </nav>
  </header>
  <h1>Surdeigsbakeri i hjertet av Oslo</h1>
  <p>Vi baker hver morgen klokken 04:00. Naturlig surdeigskultur.
  Lokalt mel fra Holli Mølle. 100 % økologisk.</p>
  <p>Levering hjemme i Oslo, eller besøk oss på Grünerløkka.</p>
  <a class="cta" href="/order">Bestill online</a>
  <a href="https://instagram.com/holycrust">Instagram</a>
  <a href="https://facebook.com/holycrustno">Facebook</a>
</body>
</html>
`;

const MOCK_CLAUDE_REFINEMENT = {
  businessName: "Holy Crust",
  tagline: "Håndlaget surdeigsbakeri i Oslo",
  description: "Surdeigsbakeri på Grünerløkka. Daglig fersk levering hjemme i Oslo.",
  toneOfVoice: "warm" as const,
  usps: [
    "Naturlig surdeigskultur, ingen industrielle tilsetninger",
    "Lokalt mel fra Holli Mølle — 100 % økologisk",
    "Hjemlevering i Oslo + butikk på Grünerløkka",
  ],
  primaryCTA: "Bestill online",
  industry: "restaurant",
  targetAudience: "Oslo-bevisste matelskere som verdsetter kortreist håndverk",
};

beforeEach(() => {
  __setWebsiteAnalyzerHttp(null);
  __setWebsiteAnalyzerAnthropic(null);
});

describe("normalizeUrl", () => {
  it("adds https:// when scheme is missing", () => {
    expect(normalizeUrl("holycrust.no")).toBe("https://holycrust.no");
  });

  it("strips utm_* params", () => {
    // Trailing slash on bare-host URLs is also stripped — see next test
    expect(
      normalizeUrl("https://holycrust.no/?utm_source=ig&utm_campaign=launch"),
    ).toBe("https://holycrust.no");
  });

  it("strips trailing slash on bare-host URLs", () => {
    expect(normalizeUrl("https://holycrust.no/")).toBe("https://holycrust.no");
  });

  it("strips fragment", () => {
    expect(normalizeUrl("https://holycrust.no/menu#pizza")).toBe(
      "https://holycrust.no/menu",
    );
  });
});

describe("hashUrl", () => {
  it("returns deterministic SHA-256 for same logical URL", () => {
    expect(hashUrl("holycrust.no")).toBe(hashUrl("https://holycrust.no/"));
    expect(hashUrl("https://holycrust.no/?utm_source=foo")).toBe(
      hashUrl("https://holycrust.no/"),
    );
  });
});

describe("parseStaticSignals", () => {
  it("extracts business name + tagline + description", () => {
    const signals = parseStaticSignals(HOLY_CRUST_HTML, "https://holycrust.no");
    expect(signals.businessName).toBe("Holy Crust");
    expect(signals.tagline).toContain("Holy Crust");
    expect(signals.description).toContain("surdeigsbrød");
  });

  it("detects primary CTA from button-like text", () => {
    const signals = parseStaticSignals(HOLY_CRUST_HTML, "https://holycrust.no");
    expect(signals.primaryCTA.toLowerCase()).toContain("bestill");
  });

  it("parses theme-color + CSS variables for color palette", () => {
    const signals = parseStaticSignals(HOLY_CRUST_HTML, "https://holycrust.no");
    expect(signals.colors.primary.toLowerCase()).toBe("#8b3a1f");
    expect(signals.colors.secondary.toLowerCase()).toBe("#d4a574");
    expect(signals.colors.accent.toLowerCase()).toBe("#f4e8d0");
  });

  it("extracts heading + body fonts from <style> blocks", () => {
    const signals = parseStaticSignals(HOLY_CRUST_HTML, "https://holycrust.no");
    expect(signals.fonts.heading).toBe("Playfair Display");
    expect(signals.fonts.body).toBe("Inter");
  });

  it("absolutifies favicon + logo URLs", () => {
    const signals = parseStaticSignals(HOLY_CRUST_HTML, "https://holycrust.no");
    expect(signals.faviconUrl).toBe("https://holycrust.no/favicon.ico");
    expect(signals.logoUrl).toBe("https://holycrust.no/logo.png");
  });

  it("detects social platform links from href hostnames", () => {
    const signals = parseStaticSignals(HOLY_CRUST_HTML, "https://holycrust.no");
    const platforms = signals.socialLinks.map((s) => s.platform).sort();
    expect(platforms).toEqual(["facebook", "instagram"]);
  });

  it("detects shop and blog from URL patterns / JSON-LD", () => {
    const signals = parseStaticSignals(HOLY_CRUST_HTML, "https://holycrust.no");
    expect(signals.hasBlog).toBe(true);
    // No /shop or Product schema → false
    expect(signals.hasShop).toBe(false);
  });

  it("collects nav-link product categories", () => {
    const signals = parseStaticSignals(HOLY_CRUST_HTML, "https://holycrust.no");
    expect(signals.productCategories).toContain("Meny");
    expect(signals.productCategories).toContain("Lokasjoner");
    // 'Kontakt' is filtered out as a default
    expect(signals.productCategories).not.toContain("Kontakt");
  });

  it("handles minimal HTML gracefully (no crashes)", () => {
    const signals = parseStaticSignals(
      "<!doctype html><html><head><title>Bare tittel</title></head><body></body></html>",
      "https://example.no",
    );
    expect(signals.businessName).toBe("Bare tittel");
    expect(signals.colors.primary).toBeTruthy(); // falls back to default
  });
});

describe("analyzeWebsite", () => {
  function mockHttp() {
    return vi.fn(async (url: string, options?: { binary?: boolean }) => {
      if (url === "https://holycrust.no" || url === "https://holycrust.no/") {
        return {
          status: 200,
          data: HOLY_CRUST_HTML,
          headers: { "content-type": "text/html" },
          finalUrl: "https://holycrust.no/",
        };
      }
      if (url.includes("favicon")) {
        return {
          status: 200,
          // 1×1 transparent PNG (smallest valid)
          data: Buffer.from(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c62000100000005000100020bf3f30000000049454e44ae426082",
            "hex",
          ),
          headers: { "content-type": "image/png" },
          finalUrl: url,
        };
      }
      return { status: 404, data: "", headers: {}, finalUrl: url };
    });
  }

  function mockClaude() {
    return {
      messages: {
        create: vi.fn(async () => ({
          content: [
            { type: "text", text: JSON.stringify(MOCK_CLAUDE_REFINEMENT) },
          ],
          usage: { input_tokens: 600, output_tokens: 200 },
        })),
      },
    };
  }

  it("returns a complete BrandProfile with Claude refinement", async () => {
    __setWebsiteAnalyzerHttp(mockHttp() as never);
    __setWebsiteAnalyzerAnthropic(mockClaude() as never);

    const profile = await analyzeWebsite("holycrust.no");

    expect(profile.businessName).toBe("Holy Crust");
    expect(profile.tagline).toContain("surdeigsbakeri");
    expect(profile.toneOfVoice).toBe("warm");
    expect(profile.industry).toBe("restaurant");
    expect(profile.usps).toHaveLength(3);
    expect(profile.usps[0]).toContain("surdeigskultur");
    // CSS-variable-extracted color survives if favicon-extraction fails
    expect(profile.colors.primary).toBeTruthy();
    expect(profile.fonts.heading).toBe("Playfair Display");
    expect(profile.socialLinks.map((s) => s.platform)).toContain("instagram");
  });

  it("works in skipClaude mode (no API call)", async () => {
    const httpFn = mockHttp();
    __setWebsiteAnalyzerHttp(httpFn as never);
    const claudeFn = mockClaude();
    __setWebsiteAnalyzerAnthropic(claudeFn as never);

    const profile = await analyzeWebsite("holycrust.no", { skipClaude: true });

    expect(profile.businessName).toBe("Holy Crust");
    expect(profile.toneOfVoice).toBe("professional"); // default in fallback
    expect(profile.industry).toBe("other");
    // Claude was NOT called
    expect(claudeFn.messages.create).not.toHaveBeenCalled();
  });

  it("throws on HTTP failure", async () => {
    __setWebsiteAnalyzerHttp(
      (async () => ({
        status: 500,
        data: "",
        headers: {},
        finalUrl: "https://holycrust.no/",
      })) as never,
    );
    await expect(analyzeWebsite("holycrust.no")).rejects.toThrow(/Failed to fetch/);
  });

  it("clamps usps to max 5 entries", async () => {
    __setWebsiteAnalyzerHttp(mockHttp() as never);
    __setWebsiteAnalyzerAnthropic({
      messages: {
        create: vi.fn(async () => ({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ...MOCK_CLAUDE_REFINEMENT,
                usps: ["a", "b", "c", "d", "e", "f", "g", "h"],
              }),
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        })),
      },
    } as never);

    const profile = await analyzeWebsite("holycrust.no");
    expect(profile.usps).toHaveLength(5);
  });

  it("falls back to 'professional' tone when Claude returns invalid value", async () => {
    __setWebsiteAnalyzerHttp(mockHttp() as never);
    __setWebsiteAnalyzerAnthropic({
      messages: {
        create: vi.fn(async () => ({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ...MOCK_CLAUDE_REFINEMENT,
                toneOfVoice: "shouty",
              }),
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        })),
      },
    } as never);

    const profile = await analyzeWebsite("holycrust.no");
    expect(profile.toneOfVoice).toBe("professional");
  });
});
