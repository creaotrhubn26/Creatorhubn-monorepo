import { describe, expect, it } from "vitest";

import { buildReviewHtml } from "./role-room-review-routes.js";

const mk = (over: Partial<{ sessionTitle: string | null; clientName: string | null; cutCount: number }> = {}) =>
  buildReviewHtml({
    session: {
      id: "s1",
      sessionTitle: over.sessionTitle === undefined ? "Sommerkampanje – Edit 2" : over.sessionTitle,
      clientName: over.clientName === undefined ? "Nordic Films" : over.clientName,
      status: "active",
      visibilitySettings: {},
    },
    cuts: Array.from({ length: over.cutCount ?? 3 }, (_, i) => ({
      id: `c${i}`, headline: `Cut ${i}`, transcriptSnippet: null, status: "pending",
      outputPath: null, thumbnailPath: null, aspectRatio: "16:9", standoutScore: null,
      startSec: 0, endSec: 12,
    })),
    comments: [],
    token: "tok",
  });

describe("buildReviewHtml — rik lenke-preview (OG)", () => {
  it("legger inn og:image mot render.png med cover-mal + Role Room-aksent", () => {
    const html = mk();
    const url = new URL(html.match(/property="og:image" content="([^"]+)"/)![1].replace(/&amp;/g, "&"));
    expect(url.pathname).toBe("/api/infographics/render.png");
    expect(url.searchParams.get("tpl")).toBe("/embed/templates/deck-cover.html");
    expect(url.origin).toMatch(/^https?:\/\//);
    const d = JSON.parse(Buffer.from(url.searchParams.get("d")!, "base64url").toString("utf8"));
    expect(d.title).toBe("Sommerkampanje – Edit 2");
    expect(d.org).toBe("Nordic Films");
    expect(d.meta).toBe("3 klipp til gjennomgang");
    expect(d.accent).toBe("#a030c0");
    expect(d.brand).toBe("Role Room");
  });

  it("faller til «Klient-review» når tittel/klient mangler", () => {
    const html = mk({ sessionTitle: null, clientName: null, cutCount: 1 });
    const d = JSON.parse(
      Buffer.from(new URL(html.match(/og:image" content="([^"]+)"/)![1].replace(/&amp;/g, "&")).searchParams.get("d")!, "base64url").toString("utf8"),
    );
    expect(d.title).toBe("Klient-review");
    expect(d.org).toBe("Klient-review");
    expect(d.meta).toBe("1 klipp til gjennomgang");
  });

  it("emitterer twitter:card + og:title/description", () => {
    const html = mk();
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('property="og:title" content="Sommerkampanje – Edit 2"');
    expect(html).toContain("Nordic Films · Klient-review · Role Room");
  });

  it("escaper session-tittel i og:title", () => {
    const html = mk({ sessionTitle: 'Edit "Final" <b>' });
    expect(html).not.toContain('content="Edit "Final"');
    expect(html).toContain("&quot;");
  });
});
