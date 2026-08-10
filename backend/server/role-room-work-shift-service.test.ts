import { describe, it, expect } from "vitest";
import {
  asStringArray,
  combineDateAndTime,
  crossesMidnight,
  pickTime,
} from "./role-room-work-shift-service.js";
import { osloDateString, osloHour } from "./role-room-oslo-time.js";

describe("crossesMidnight", () => {
  it("kjenner igjen et nattopptak", () => {
    expect(crossesMidnight("18:00", "02:00")).toBe(true);
  });

  it("lar en vanlig dag være en vanlig dag", () => {
    expect(crossesMidnight("07:00", "19:00")).toBe(false);
  });

  it("regner likt klokkeslett som et helt døgn, ikke som null", () => {
    // 07:00–07:00 er 24 timer. Uten dette ville vakten fått lengde null og
    // sluppet gjennom AML-sjekken som en dag ingen jobbet.
    expect(crossesMidnight("07:00", "07:00")).toBe(true);
  });
});

describe("combineDateAndTime", () => {
  it("tolker klokkeslettet som norsk tid, ikke serverens", () => {
    // Testene kjører i UTC. 07:30 norsk vintertid er 06:30 UTC.
    expect(combineDateAndTime("2027-03-15", "07:30")).toBe("2027-03-15T06:30:00.000Z");
    expect(osloHour(new Date(combineDateAndTime("2027-03-15", "07:30")))).toBe(7);
  });

  it("holder klokkeslettet fast over sommertidsskiftet", () => {
    // 2027-03-28 stilles klokka fram. Innkalling 07:00 er 07:00 norsk både
    // før og etter, selv om tidspunktene ligger en time fra hverandre i UTC.
    expect(osloHour(new Date(combineDateAndTime("2027-03-27", "07:00")))).toBe(7);
    expect(osloHour(new Date(combineDateAndTime("2027-03-29", "07:00")))).toBe(7);
  });

  it("skyver wrap til neste døgn når dagen krysser midnatt", () => {
    const wrap = new Date(combineDateAndTime("2027-03-15", "02:00", 1));
    expect(osloDateString(wrap)).toBe("2027-03-16");
    expect(osloHour(wrap)).toBe(2);
  });

  it("holder rekkefølgen for et nattopptak", () => {
    // Uten dagskiftet ville wrap ligget før call, og CHECK-constrainten i
    // migrering 0456 ville avvist raden.
    const call = new Date(combineDateAndTime("2027-03-15", "18:00"));
    const wrap = new Date(combineDateAndTime("2027-03-15", "02:00", 1));
    expect(wrap.getTime()).toBeGreaterThan(call.getTime());
  });

  it("krysser månedsskiftet riktig", () => {
    const wrap = new Date(combineDateAndTime("2027-03-31", "01:00", 1));
    expect(osloDateString(wrap)).toBe("2027-04-01");
  });

  it("avviser ugyldige verdier framfor å lage en NaN-dato", () => {
    expect(() => combineDateAndTime("ikke-en-dato", "07:00")).toThrow();
    expect(() => combineDateAndTime("2027-03-15", "tulletid")).toThrow();
  });
});

describe("asStringArray", () => {
  it("takler ekte array", () => {
    expect(asStringArray(["a", "b"])).toEqual(["a", "b"]);
  });

  it("takler JSONB som kommer som streng", () => {
    expect(asStringArray('["a","b"]')).toEqual(["a", "b"]);
  });

  it("gir tom liste framfor å kaste på søppel", () => {
    expect(asStringArray("{ikke json")).toEqual([]);
    expect(asStringArray(null)).toEqual([]);
    expect(asStringArray(42)).toEqual([]);
  });

  it("fjerner tomme id-er", () => {
    expect(asStringArray(["a", "", "b"])).toEqual(["a", "b"]);
  });
});

describe("pickTime", () => {
  it("lar overstyring vinne over dagens egen tid", () => {
    expect(pickTime("06:30", "09:00")).toBe("06:30");
  });

  it("faller tilbake på dagens tid når ingenting er oppgitt", () => {
    // Poenget med hele fallbacken: produsenten har allerede fylt inn
    // innkalling og wrap på dagsplanen og skal slippe å gjenta seg.
    expect(pickTime(undefined, "09:00")).toBe("09:00");
  });

  it("regner ugyldig format som fraværende framfor å sende det videre", () => {
    expect(pickTime("i morgen tidlig", "09:00")).toBe("09:00");
    expect(pickTime("25:00", "09:00")).toBe("09:00");
    expect(pickTime(undefined, "")).toBeNull();
    expect(pickTime(null, undefined)).toBeNull();
  });

  it("klipper bort sekunder", () => {
    expect(pickTime("07:15:00", null)).toBe("07:15");
  });
});
