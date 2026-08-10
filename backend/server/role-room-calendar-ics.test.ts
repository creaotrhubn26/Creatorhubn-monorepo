import { describe, it, expect } from "vitest";
import {
  buildIcsFeed,
  escapeIcsText,
  foldIcsLine,
  toIcsDate,
  toIcsTimestamp,
  toLocalDateString,
} from "./role-room-calendar-ics.js";

const NOW = new Date("2026-08-01T09:30:00Z");

describe("escapeIcsText", () => {
  it("escaper backslash før de andre tegnene", () => {
    // Feil rekkefølge ville gitt \\; i stedet for \\\;
    expect(escapeIcsText("a\\b;c")).toBe("a\\\\b\\;c");
  });

  it("escaper komma, som ellers deler feltet i to", () => {
    expect(escapeIcsText("Oslo, Norge")).toBe("Oslo\\, Norge");
  });

  it("gjør linjeskift om til \\n", () => {
    expect(escapeIcsText("linje1\nlinje2")).toBe("linje1\\nlinje2");
    expect(escapeIcsText("linje1\r\nlinje2")).toBe("linje1\\nlinje2");
  });

  it("takler tom og udefinert verdi", () => {
    expect(escapeIcsText("")).toBe("");
    expect(escapeIcsText(undefined as unknown as string)).toBe("");
  });
});

describe("foldIcsLine", () => {
  it("lar korte linjer stå urørt", () => {
    expect(foldIcsLine("SUMMARY:Kort")).toBe("SUMMARY:Kort");
  });

  it("bretter lange linjer med mellomrom som fortsettelse", () => {
    const long = "SUMMARY:" + "a".repeat(200);
    const folded = foldIcsLine(long);
    expect(folded).toContain("\r\n ");
    for (const segment of folded.split("\r\n")) {
      expect(Buffer.byteLength(segment, "utf8")).toBeLessThanOrEqual(75);
    }
  });

  it("teller oktetter, ikke tegn", () => {
    // 40 norske tegn = 80 byte. Talt som tegn ville dette ikke blitt brettet,
    // og filen ville vært ugyldig for strenge klienter.
    const line = "SUMMARY:" + "æ".repeat(40);
    const folded = foldIcsLine(line);
    expect(folded).toContain("\r\n ");
    for (const segment of folded.split("\r\n")) {
      expect(Buffer.byteLength(segment, "utf8")).toBeLessThanOrEqual(75);
    }
  });

  it("bretter aldri midt i et flerbyte-tegn", () => {
    const folded = foldIcsLine("SUMMARY:" + "ø".repeat(60));
    // Round-trip gjennom UTF-8 ville gitt U+FFFD hvis et tegn var delt.
    expect(folded).not.toContain("�");
    expect(folded.replace(/\r\n /g, "")).toBe("SUMMARY:" + "ø".repeat(60));
  });

  it("bevarer innholdet når brettingen fjernes", () => {
    const line = "DESCRIPTION:" + "Lorem ipsum dolor sit amet ".repeat(10);
    expect(foldIcsLine(line).replace(/\r\n /g, "")).toBe(line);
  });
});

describe("dato- og tidsformatering", () => {
  it("formaterer heldagsdato som YYYYMMDD", () => {
    expect(toIcsDate("2026-08-15")).toBe("20260815");
  });

  it("formaterer tidsstempel som UTC med Z", () => {
    expect(toIcsTimestamp(NOW)).toBe("20260801T093000Z");
  });

  it("nullpolstrer måned og dag", () => {
    expect(toIcsDate("2026-01-05")).toBe("20260105");
  });
});

describe("buildIcsFeed", () => {
  const base = {
    projectName: "TROLL",
    now: NOW,
    events: [
      {
        uid: "shoot-1@theroleroom.com",
        date: "2026-08-15",
        summary: "Opptak – TROLL",
        location: "Ålesund, Kaia 3",
        description: "Husk regntøy",
      },
    ],
  };

  it("har gyldig ramme", () => {
    const ics = buildIcsFeed(base);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:");
  });

  it("bruker CRLF, som spesifikasjonen krever", () => {
    const ics = buildIcsFeed(base);
    // Ingen nakne LF uten foranstilt CR.
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it("setter DTEND til dagen etter (eksklusiv)", () => {
    // Uten +1 dag vises opptaksdagen som «ingen dager» i Google Calendar.
    const ics = buildIcsFeed(base);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260815");
    expect(ics).toContain("DTEND;VALUE=DATE:20260816");
  });

  it("håndterer månedsskifte i DTEND", () => {
    const ics = buildIcsFeed({ ...base, events: [{ ...base.events[0], date: "2026-08-31" }] });
    expect(ics).toContain("DTEND;VALUE=DATE:20260901");
  });

  it("håndterer skuddår", () => {
    const ics = buildIcsFeed({ ...base, events: [{ ...base.events[0], date: "2028-02-29" }] });
    expect(ics).toContain("DTEND;VALUE=DATE:20280301");
  });

  it("escaper komma i stedsnavn", () => {
    expect(buildIcsFeed(base)).toContain("Ålesund\\, Kaia 3");
  });

  it("merker avlyste dager som CANCELLED", () => {
    const ics = buildIcsFeed({ ...base, events: [{ ...base.events[0], cancelled: true }] });
    expect(ics).toContain("STATUS:CANCELLED");
  });

  it("gir hver hendelse en stabil UID", () => {
    // Samme UID ved neste henting = oppdatering, ikke duplikat.
    const a = buildIcsFeed(base);
    const b = buildIcsFeed({ ...base, now: new Date("2026-09-01T00:00:00Z") });
    expect(a).toContain("UID:shoot-1@theroleroom.com");
    expect(b).toContain("UID:shoot-1@theroleroom.com");
  });

  it("takler tom hendelsesliste uten å produsere ugyldig fil", () => {
    const ics = buildIcsFeed({ ...base, events: [] });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("utelater valgfrie felter når de mangler", () => {
    const ics = buildIcsFeed({
      ...base,
      events: [{ uid: "x@y", date: "2026-08-15", summary: "Bare tittel" }],
    });
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("LOCATION:");
  });

  it("har like mange BEGIN som END for hendelser", () => {
    const ics = buildIcsFeed({
      ...base,
      events: [base.events[0], { ...base.events[0], uid: "shoot-2@x" }],
    });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2);
  });
});

describe("toLocalDateString (tidssone-fellen)", () => {
  it("beholder dagen for en DATE-kolonne uansett tidssone", () => {
    // node-postgres gir DATE som Date på LOKAL midnatt. toISOString() ville
    // flyttet 15. august til 14. august i Europe/Oslo — altså ville hver
    // opptaksdag vist én dag for tidlig hos alle abonnenter.
    const localMidnight = new Date(2026, 7, 15, 0, 0, 0);
    expect(toLocalDateString(localMidnight)).toBe("2026-08-15");
  });

  it("beholder dagen sent på kvelden, der UTC allerede er neste døgn", () => {
    const lateEvening = new Date(2026, 7, 15, 23, 30, 0);
    expect(toLocalDateString(lateEvening)).toBe("2026-08-15");
  });

  it("nullpolstrer måned og dag", () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 12, 0, 0))).toBe("2026-01-05");
  });

  it("klipper en ISO-streng til datodelen", () => {
    expect(toLocalDateString("2026-08-15T22:00:00.000Z")).toBe("2026-08-15");
  });
});
