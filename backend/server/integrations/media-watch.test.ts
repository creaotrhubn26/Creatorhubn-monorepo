import { describe, expect, it } from "vitest";

import { parseRssItems, titleMatches, MEDIA_FEEDS } from "./media-watch.js";

const XML = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title><![CDATA[Dansekompani satser stort i Bergen]]></title><link>https://nrk.no/a1</link><pubDate>Sun, 13 Jul 2026 06:00:00 GMT</pubDate></item>
<item><title>Uten lenke hoppes over</title></item>
<item><title>Filmbransjen varsler kutt</title><link>https://kampanje.com/b2</link><pubDate>ugyldig dato</pubDate></item>
</channel></rss>`;

describe("parseRssItems (minimal RSS 2.0)", () => {
  it("parser CDATA-titler, lenker og datoer; hopper over items uten lenke", () => {
    const items = parseRssItems(XML);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ title: "Dansekompani satser stort i Bergen", link: "https://nrk.no/a1", pubDate: "2026-07-13" });
    expect(items[1].pubDate).toBeNull(); // ugyldig dato → null, ikke krasj
  });
});

describe("titleMatches (ord-grense — «dans» treffer ikke «danske»)", () => {
  it("krever ordgrenser rundt treffet", () => {
    expect(titleMatches("Ny satsing på dans i skolen", "dans")).toBe(true);
    expect(titleMatches("Danske investorer kjøper opp", "dans")).toBe(false);
    expect(titleMatches("Dans!", "dans")).toBe(true);
    expect(titleMatches("Kutt i filmbransjen", "film")).toBe(false); // inne i ord
    expect(titleMatches("Film og TV samles", "film")).toBe(true);
  });
});

describe("MEDIA_FEEDS", () => {
  it("E24 er ikke med (restriktive feed-vilkår)", () => {
    expect(MEDIA_FEEDS.some((f) => f.url.includes("e24"))).toBe(false);
  });
});
