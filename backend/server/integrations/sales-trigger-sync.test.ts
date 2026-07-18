import { describe, expect, it, vi } from "vitest";

import {
  extractTenderRequirements,
  isFreshTrigger,
  TENDER_SOURCING,
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

  it("klassifiserer can-* som tildeling, ikke åpent anbud (496990-2026, 17.07.2026)", () => {
    // Reelt tilfelle: kontrakt signert 15.07 ble servert som «vurder om
    // dere kan levere» fordi notice-type aldri ble hentet.
    const out = mapTedNotices(
      [
        {
          "publication-number": "496990-2026",
          "notice-title": { eng: ["Framework agreement for digital recruitment campaigns"] },
          "publication-date": "2026-07-17+00:00",
          "notice-type": "can-standard",
          "buyer-name": { eng: ["Jernbanedirektoratet"] },
        },
        {
          "publication-number": "111111-2026",
          "notice-title": { nor: ["Rammeavtale fototjenester"] },
          "publication-date": "2026-07-16+00:00",
          "notice-type": "cn-standard",
          "deadline-receipt-tender-date-lot": ["2026-08-20+00:00"],
        },
        {
          "publication-number": "222222-2026",
          "notice-title": { nor: ["Markedsdialog videoproduksjon"] },
          "notice-type": "pin-buyer",
        },
      ],
      "The Role Room — casting og produksjon",
    );
    expect(out.map((e) => e.kind)).toEqual(["award", "tender", "tender"]);
    expect(out[0].raw).toMatchObject({ buyerName: "Jernbanedirektoratet", noticeType: "can-standard" });
    expect(out[1].raw).toMatchObject({ deadline: "2026-08-20", requirements: ["rammeavtale"] });
    expect(out[2].raw).toMatchObject({ isRfi: true });
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
    let call = 0;
    const pool = { query: vi.fn(async () => (++call === 1 ? { rows: [], rowCount: 0 } : { rows, rowCount: rows.length })) } as unknown as import("pg").Pool;
    const out = await detector.run(pool, "org-1");
    expect(out).toHaveLength(2);
    expect(out[0].severity).toBe("important");
    expect(out[0].dedupeKey).toBe("trigger|ted|327903-2016");
    expect(out[0].evidence[0].value).toContain("ted.europa.eu");
    expect(out[1].severity).toBe("notable");
  });
});

describe("award- og RFI-klassifisering", () => {
  it("RESULT → kind award m/ vinner og antall tilbud", () => {
    const out = mapDoffinHits(
      [{
        id: "2026-9", heading: "Rammeavtale video", publicationDate: "2026-07-06",
        allTypes: ["RESULT"], receivedTenders: 12,
        lots: [{ winner: [{ name: "Racecar AS", organizationId: "980530582" }] }],
      }],
      "CreatorHub — fotografer og videografer",
    );
    expect(out[0].kind).toBe("award");
    expect(out[0].raw).toMatchObject({ winnerName: "Racecar AS", winnerOrgNr: "980530582", receivedTenders: 12 });
  });

  it("PLANNING → tender m/ isRfi; CANCELLED hoppes over", () => {
    const out = mapDoffinHits(
      [
        { id: "1", heading: "Markedsundersøkelse foto", allTypes: ["PLANNING"], status: "ACTIVE" },
        { id: "2", heading: "Avlyst", allTypes: ["CANCELLED_OR_MISSING_CONCLUSION_OF_CONTRACT"] },
      ],
      "v",
    );
    expect(out).toHaveLength(1);
    expect(out[0].raw).toMatchObject({ isRfi: true });
    expect(out[0].kind).toBe("tender");
  });
});

describe("isFreshTrigger (gamle anbud er ikke salgsvindu)", () => {
  const now = new Date("2026-07-13T00:00:00Z");
  const base = { source: "ted" as const, eventId: "x", kind: "tender" as const, title: "t", url: null, matchedTopic: "v" };

  it("beholder ferske, forkaster eldre enn 60 dager, beholder ukjent dato", () => {
    expect(isFreshTrigger({ ...base, publishedAt: "2026-07-03" }, now)).toBe(true);
    expect(isFreshTrigger({ ...base, publishedAt: "2016-09-21" }, now)).toBe(false);
    expect(isFreshTrigger({ ...base, publishedAt: null }, now)).toBe(true);
  });
});

describe("extractTenderRequirements (deterministisk krav-leksikon)", () => {
  it("finner krav i tekst, uavhengig av store/små bokstaver", () => {
    const reqs = extractTenderRequirements(
      "Rammeavtale for videoproduksjon. Leverandør må ha ISO 14001 og tilby elektronisk faktura (EHF). Krav om universell utforming (WCAG 2.1).",
    );
    expect(reqs).toEqual(expect.arrayContaining(["rammeavtale", "miljo", "ehf", "universell"]));
    expect(reqs).not.toContain("sikkerhet");
  });

  it("tom tekst gir tom liste — ingen defaults", () => {
    expect(extractTenderRequirements("")).toEqual([]);
  });
});

describe("TRIGGER_KEYWORDS (justeringsflate)", () => {
  it("alle vertikaler har minst ett nøkkelord", () => {
    for (const [name, kws] of Object.entries(TRIGGER_KEYWORDS)) {
      expect(kws.length, name).toBeGreaterThan(0);
    }
  });
});

describe("TENDER_SOURCING (kvalitetsrunden: CPV-først)", () => {
  it("hver sourcet vertikal har CPV eller bevist tekstsøk — aldri begge tomme", () => {
    for (const [name, src] of Object.entries(TENDER_SOURCING)) {
      expect(src.cpv.length + src.doffinText.length, name).toBeGreaterThan(0);
    }
  });

  it("CPV-koder er 8-sifrede", () => {
    for (const src of Object.values(TENDER_SOURCING)) {
      for (const cpv of src.cpv) expect(cpv).toMatch(/^\d{8}$/);
    }
  });
});
