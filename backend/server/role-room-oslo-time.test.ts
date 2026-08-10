import { describe, it, expect } from "vitest";
import {
  osloDateString,
  osloHour,
  osloInstant,
  osloInstantFrom,
  osloOffsetMs,
} from "./role-room-oslo-time.js";

const HOUR = 3_600_000;

describe("osloOffsetMs", () => {
  it("gir +1 time om vinteren", () => {
    expect(osloOffsetMs(new Date("2027-01-15T12:00:00Z"))).toBe(HOUR);
  });

  it("gir +2 timer om sommeren", () => {
    expect(osloOffsetMs(new Date("2027-07-15T12:00:00Z"))).toBe(2 * HOUR);
  });
});

describe("osloHour", () => {
  it("leser norsk klokke, ikke serverens", () => {
    // Testene kjører i UTC. Uten soneoppslaget ville dette blitt 19.
    expect(osloHour(new Date("2027-07-15T19:30:00Z"))).toBe(21);
  });

  it("fanger midnatt som 0, ikke 24", () => {
    expect(osloHour(new Date("2027-01-15T23:00:00Z"))).toBe(0);
  });
});

describe("osloInstant", () => {
  it("tolker et klokkeslett som norsk tid", () => {
    // 07:00 norsk sommertid = 05:00 UTC.
    expect(osloInstant(2027, 7, 15, 7, 0).toISOString()).toBe("2027-07-15T05:00:00.000Z");
  });

  it("tolker vintertid riktig", () => {
    expect(osloInstant(2027, 1, 15, 7, 0).toISOString()).toBe("2027-01-15T06:00:00.000Z");
  });

  it("holder seg til norsk klokke over sommertidsskiftet", () => {
    // Sommertid starter siste søndag i mars (2027-03-28). En vakt kl. 07:00
    // dagen før og dagen etter skal begge leses som 07:00 norsk — selv om de
    // ligger én time fra hverandre i UTC.
    expect(osloHour(osloInstant(2027, 3, 27, 7, 0))).toBe(7);
    expect(osloHour(osloInstant(2027, 3, 29, 7, 0))).toBe(7);
    expect(osloInstant(2027, 3, 27, 7, 0).toISOString()).toBe("2027-03-27T06:00:00.000Z");
    expect(osloInstant(2027, 3, 29, 7, 0).toISOString()).toBe("2027-03-29T05:00:00.000Z");
  });

  it("treffer riktig også rett etter selve skiftet", () => {
    // 03:00 natt til 28. mars er etter at klokka er stilt fram.
    expect(osloHour(osloInstant(2027, 3, 28, 3, 0))).toBe(3);
  });

  it("treffer riktig ved høstskiftet, der en time gjentas", () => {
    // Siste søndag i oktober 2027 er den 31. Klokka stilles tilbake, så
    // 02:30 finnes to ganger. Vi skal lande på én av dem, ikke på 01:30.
    expect(osloHour(osloInstant(2027, 10, 31, 2, 30))).toBe(2);
  });
});

describe("osloInstantFrom", () => {
  it("setter sammen dato og klokkeslett i norsk tid", () => {
    expect(osloInstantFrom("2027-07-15", "18:00").toISOString()).toBe("2027-07-15T16:00:00.000Z");
  });

  it("skyver til neste døgn når dagen krysser midnatt", () => {
    const wrap = osloInstantFrom("2027-07-15", "02:00", 1);
    expect(wrap.toISOString()).toBe("2027-07-16T00:00:00.000Z");
    expect(osloHour(wrap)).toBe(2);
  });

  it("avviser søppel framfor å lage en NaN-dato", () => {
    expect(() => osloInstantFrom("ikke-en-dato", "07:00")).toThrow();
    expect(() => osloInstantFrom("2027-07-15", "tulletid")).toThrow();
  });
});

describe("osloDateString", () => {
  it("bruker norsk døgngrense, ikke UTCs", () => {
    // 23:30 UTC er 01:30 norsk neste dag om sommeren. Datoen skal følge Norge.
    expect(osloDateString(new Date("2027-07-15T23:30:00Z"))).toBe("2027-07-16");
  });
});
