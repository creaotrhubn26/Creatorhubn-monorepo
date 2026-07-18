import { describe, expect, it } from "vitest";

import { renderDeckHtml } from "./pitch-deck-pdf-service.js";

const base = (deckName: string, orgName: string, slideCount: number) =>
  renderDeckHtml({
    deckName,
    orgName,
    viewToken: "tok_test",
    slides: Array.from({ length: slideCount }, (_, i) => ({
      position: i,
      slide_type: "content",
      title_md: `Slide ${i}`,
      body_md: "…",
    })) as any,
  });

describe("renderDeckHtml — rik lenke-preview (OG)", () => {
  it("legger inn og:image mot render.png med deck-cover-malen", () => {
    const html = base("Q3 Vekstplan", "Acme AS", 8);
    const m = html.match(/property="og:image" content="([^"]+)"/);
    expect(m).toBeTruthy();
    const url = new URL(m![1].replace(/&amp;/g, "&"));
    expect(url.pathname).toBe("/api/infographics/render.png");
    expect(url.searchParams.get("tpl")).toBe("/embed/templates/deck-cover.html");
    // absolutt URL (crawlere trenger det)
    expect(url.origin).toMatch(/^https?:\/\//);
    // data base64url-kodet med tittel/org/meta
    const d = JSON.parse(Buffer.from(url.searchParams.get("d")!, "base64url").toString("utf8"));
    expect(d.title).toBe("Q3 Vekstplan");
    expect(d.org).toBe("Acme AS");
    expect(d.meta).toBe("8 slides");
  });

  it("emitterer twitter:card=summary_large_image + og:title/description", () => {
    const html = base("Salgspitch", "Bolt", 3);
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('property="og:title" content="Salgspitch"');
    expect(html).toContain('property="og:type" content="website"');
    expect(html).toContain("Bolt · Pitch-deck");
  });

  it("entall «slide» ved nøyaktig én", () => {
    const d = JSON.parse(
      Buffer.from(
        new URL(base("En-slide", "X", 1).match(/og:image" content="([^"]+)"/)![1].replace(/&amp;/g, "&"))
          .searchParams.get("d")!,
        "base64url",
      ).toString("utf8"),
    );
    expect(d.meta).toBe("1 slide");
  });

  it("escaper deck-navn i og:title (ingen attributt-brudd)", () => {
    const html = base('Plan "A" <b>', "Org", 2);
    expect(html).not.toContain('content="Plan "A"');
    expect(html).toContain("&quot;");
  });
});
