import { describe, expect, it } from "vitest";

import {
  buildRetenderWindows,
  buildTenderBoard,
  dedupeTenders,
  isSameTender,
  type BoardTenderRow,
} from "./tender-board.js";

function row(overrides: Partial<BoardTenderRow>): BoardTenderRow {
  return {
    source: "doffin",
    event_id: "e1",
    kind: "tender",
    title: "Rammeavtale fototjenester",
    url: null,
    published_at: "2026-07-10",
    matched_topic: "CreatorHub — fotografer og videografer",
    raw: {},
    ...overrides,
  };
}

describe("isSameTender (deterministisk dedup)", () => {
  it("samme kilde: nesten lik tittel = samme anbud (Skyss-tilfellet)", () => {
    const a = row({ source: "ted", event_id: "1", title: "Norway – Advertising and marketing services – Advertising agency services Skyss 2026" });
    const b = row({ source: "ted", event_id: "2", title: "Norway – Advertising and marketing services – Advertising agency services Skyss 2026", published_at: "2026-06-25" });
    expect(isSameTender(a, b)).toBe(true);
  });

  it("på tvers av kilder: krever samme oppdragsgiver innen 14 dager — tittelspråkene er ulike", () => {
    const ted = row({ source: "ted", title: "Framework agreement for photo services", raw: { buyerName: "Skyss AS" }, published_at: "2026-07-10" });
    const doffin = row({ source: "doffin", title: "Rammeavtale fototjenester", raw: { buyerName: "Skyss" }, published_at: "2026-07-05" });
    expect(isSameTender(ted, doffin)).toBe(true); // AS-suffiks normaliseres
    expect(isSameTender(ted, row({ source: "doffin", raw: { buyerName: "Skyss" }, published_at: "2026-05-01" }))).toBe(false); // for langt fra hverandre
    expect(isSameTender(ted, row({ source: "doffin", raw: {} }))).toBe(false); // uten oppdragsgiver: aldri sammenslått
  });

  it("ulike anbud fra samme kilde grupperes ikke", () => {
    const a = row({ source: "ted", title: "Framework agreement for photo services" });
    const b = row({ source: "ted", title: "Snow removal and winter maintenance northern region" });
    expect(isSameTender(a, b)).toBe(false);
  });
});

describe("buildTenderBoard", () => {
  it("slår sammen, foretrekker Doffin som primær og beholder alle kildelenker", () => {
    const board = buildTenderBoard(
      [
        row({ source: "ted", event_id: "t1", title: "Framework agreement for photo services", url: "https://ted.europa.eu/x", raw: { buyerName: "Skyss AS", deadline: "2026-08-20" } }),
        row({ source: "doffin", event_id: "d1", title: "Rammeavtale fototjenester", url: "https://doffin.no/x", raw: { buyerName: "Skyss", valueNok: 2_000_000 } }),
      ],
      null,
    );
    expect(board).toHaveLength(1);
    expect(board[0].source).toBe("doffin");
    // Felt hentes på tvers av de sammenslåtte radene: frist fra TED, verdi fra Doffin
    expect(board[0].deadline).toBe("2026-08-20");
    expect(board[0].valueNok).toBe(2_000_000);
    expect(board[0].altSources).toEqual([{ source: "ted", eventId: "t1", url: "https://ted.europa.eu/x" }]);
  });

  it("fit beregnes mot profil; triage-status hentes fra hvilken som helst rad i gruppen", () => {
    const board = buildTenderBoard(
      [
        row({ event_id: "a", raw: { requirements: ["miljo", "ehf"], bidStatus: "interested", bidReason: null } }),
        row({ event_id: "b", source: "ted", title: "Photo services framework", raw: { buyerName: "X" } }),
      ],
      { miljo: true, ehf: false },
    );
    const card = board.find((t) => t.eventId === "a")!;
    expect(card.fit).toMatchObject({ have: ["miljo"], missing: ["ehf"], unknown: [] });
    expect(card.bidStatus).toBe("interested");
    // Ukjent/gammel status-streng faller trygt tilbake til 'new'
    expect(buildTenderBoard([row({ raw: { bidStatus: "tullestatus" } })], null)[0].bidStatus).toBe("new");
  });
});

describe("buildRetenderWindows (radar)", () => {
  it("tildeling + 2 år, sortert på vindu; rader uten dato utelates", () => {
    const windows = buildRetenderWindows([
      row({ kind: "award", published_at: "2026-07-15", raw: { winnerName: "Layer Byrå AS", valueNok: 4_000_000, buyerName: "Jernbanedirektoratet" } }),
      row({ kind: "award", published_at: "2026-07-01", event_id: "w2" }),
      row({ kind: "award", published_at: null, event_id: "w3" }),
    ]);
    expect(windows).toHaveLength(2);
    expect(windows[0].expectedRetender).toBe("2028-07");
    expect(windows.map((w) => w.awardedAt)).toEqual(["2026-07-01", "2026-07-15"]);
    expect(windows[1].winnerName).toBe("Layer Byrå AS");
  });
});
