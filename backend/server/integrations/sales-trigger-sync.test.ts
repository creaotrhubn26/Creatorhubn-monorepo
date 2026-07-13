import { describe, expect, it, vi } from "vitest";

import {
  mapDoffinHits,
  mapGdeltArticles,
  mapTedNotices,
  TRIGGER_KEYWORDS,
} from "./sales-trigger-sync.js";
import { INSIGHT_DETECTORS } from "./insight-engine.js";

describe("mapTedNotices (struktur verifisert mot API 2026-07-13)", () => {
  it("foretrekker norsk tittel, bygger stabil kunngjørings-URL", () => {
    const out = mapTedNotices(
      [
        {
          "publication-number": "327903-2016",
          "notice-title": { eng: ["Photo services"], nor: ["Fototjenester"] },
          "publication-date": "2016-09-21+02:00",
        },
        { "notice-title": { eng: "uten id — hoppes over" } },
      ],
      "CreatorHub — fotografer og videografer",
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      source: "ted",
      kind: "tender",
      eventId: "327903-2016",
      title: "Fototjenester",
      url: "https://ted.europa.eu/en/notice/327903-2016",
      publishedAt: "2016-09-21",
    });
  });
});

describe("mapGdeltArticles", () => {
  it("dedupliserer på URL og parser seendate", () => {
    const a = { url: "https://e24.no/x", title: "Kjede satser på bærekraft", seendate: "20260710T060000Z" };
    const out = mapGdeltArticles([a, a, { title: "uten url" }], "Lead AS");
    expect(out).toHaveLength(1);
    expect(out[0].publishedAt).toBe("2026-07-10");
    expect(out[0].kind).toBe("strategy_media");
  });
});

describe("mapDoffinHits", () => {
  it("mapper defensivt (heading eller title)", () => {
    const out = mapDoffinHits(
      [{ id: "2026-123", heading: "Fototjenester rammeavtale", publicationDate: "2026-07-10T00:00:00Z" }],
      "CreatorHub — fotografer og videografer",
    );
    expect(out[0]).toMatchObject({
      source: "doffin",
      eventId: "2026-123",
      url: "https://www.doffin.no/notices/2026-123",
      publishedAt: "2026-07-10",
    });
  });
});

describe("sales-trigger-detektoren", () => {
  const detector = INSIGHT_DETECTORS.find((d) => d.detectorKey === "sales-trigger")!;

  it("anbud = important m/ kilde-evidens; media = notable; dedupeKey per hendelse", async () => {
    const rows = [
      {
        source: "ted", event_id: "327903-2016", kind: "tender",
        title: "Fototjenester", url: "https://ted.europa.eu/en/notice/327903-2016",
        published_at: "2026-07-10", matched_topic: "CreatorHub — fotografer og videografer",
      },
      {
        source: "gdelt", event_id: "https://e24.no/x", kind: "strategy_media",
        title: "Kjede satser på bærekraft", url: "https://e24.no/x",
        published_at: "2026-07-10", matched_topic: "Lead AS",
      },
    ];
    const pool = { query: vi.fn(async () => ({ rows, rowCount: rows.length })) } as unknown as import("pg").Pool;
    const out = await detector.run(pool, "org-1");
    expect(out).toHaveLength(2);
    expect(out[0].severity).toBe("important");
    expect(out[0].dedupeKey).toBe("trigger|ted|327903-2016");
    expect(out[0].evidence[0].value).toContain("ted.europa.eu");
    expect(out[1].severity).toBe("notable");
  });
});

describe("TRIGGER_KEYWORDS (justeringsflate)", () => {
  it("alle vertikaler har minst ett nøkkelord", () => {
    for (const [name, kws] of Object.entries(TRIGGER_KEYWORDS)) {
      expect(kws.length, name).toBeGreaterThan(0);
    }
  });
});
