import { describe, it, expect } from "vitest";
import { isSchoolDay } from "./role-room-work-time-service.js";

describe("isSchoolDay", () => {
  it("regner ukedager som skoledager", () => {
    // 2026-08-17 er en mandag.
    expect(isSchoolDay(new Date(2026, 7, 17))).toBe(true);
  });

  it("regner helg som skolefri", () => {
    expect(isSchoolDay(new Date(2026, 7, 22))).toBe(false); // lørdag
    expect(isSchoolDay(new Date(2026, 7, 23))).toBe(false); // søndag
  });

  it("regner juli som fellesferie", () => {
    expect(isSchoolDay(new Date(2026, 6, 15))).toBe(false);
  });

  it("er konservativ framfor treffsikker", () => {
    // Slår ut som skoledag oftere enn den strengt tatt burde: et falskt varsel
    // koster en oppklaring, en oversett skoledag koster et lovbrudd.
    expect(isSchoolDay(new Date(2026, 9, 5))).toBe(true); // høstferie varierer per kommune
  });

  it("takler ugyldig verdi uten å kaste", () => {
    expect(isSchoolDay("ikke en dato")).toBe(false);
    expect(isSchoolDay(null)).toBe(false);
  });
});

// ── Dekning og status ──────────────────────────────────────────────────────
//
// Den viktigste egenskapen i hele funksjonen: «0 brudd» må aldri kunne bety
// «ingen data». Et etterlevelsesverktøy som er grønt av mangel på grunnlag er
// farligere enn et som ikke finnes.

import { summariseStatus, type WorkTimeCoverage } from "./role-room-work-time-service.js";

const coverage = (patch: Partial<WorkTimeCoverage> = {}): WorkTimeCoverage => ({
  productionDays: 0,
  daysWithShifts: 0,
  daysMissingShifts: [],
  shiftsWithoutDay: 0,
  peopleMissingBirthDate: 0,
  ...patch,
});

describe("summariseStatus", () => {
  it("sier «ingen data», ikke «ingen brudd», når ingen har vakter", () => {
    const { status, statusMessage } = summariseStatus(
      coverage({ productionDays: 6, daysMissingShifts: [{ id: "d1", date: "2027-03-15" }] }),
      0,
      0,
    );
    expect(status).toBe("no_data");
    expect(statusMessage).toMatch(/kan ikke si/);
    expect(statusMessage).not.toMatch(/ingen brudd/i);
  });

  it("skiller «ingen opptaksdager» fra «dager uten vakter»", () => {
    const { statusMessage } = summariseStatus(coverage(), 0, 0);
    expect(statusMessage).toMatch(/Ingen opptaksdager/);
  });

  it("melder brudd, og sier fra om det finnes dager den ikke har sett", () => {
    const { status, statusMessage } = summariseStatus(
      coverage({ productionDays: 4, daysWithShifts: 2, daysMissingShifts: [{ id: "d1", date: "2027-03-15" }, { id: "d2", date: "2027-03-16" }] }),
      3,
      5,
    );
    expect(status).toBe("violations");
    expect(statusMessage).toMatch(/3 brudd/);
    expect(statusMessage).toMatch(/2 opptaksdager mangler vakter/);
  });

  it("kaller det «delvis» når noen dager mangler, selv uten brudd", () => {
    const { status, statusMessage } = summariseStatus(
      coverage({ productionDays: 3, daysWithShifts: 2, daysMissingShifts: [{ id: "d3", date: "2027-03-17" }] }),
      0,
      4,
    );
    expect(status).toBe("partial");
    expect(statusMessage).toMatch(/ikke vurdert/);
  });

  it("gir grønt bare når alle dagene er dekket og ingenting er brutt", () => {
    const { status } = summariseStatus(
      coverage({ productionDays: 3, daysWithShifts: 3 }),
      0,
      7,
    );
    expect(status).toBe("ok");
  });

  it("sier fra om manglende fødselsdato selv når statusen er grønn", () => {
    // Uten fødselsdato kan kap. 11 ikke avgjøres — det er en forbehold, ikke
    // et brudd, men det skal ikke forsvinne i et grønt felt.
    const { status, statusMessage } = summariseStatus(
      coverage({ productionDays: 2, daysWithShifts: 2, peopleMissingBirthDate: 2 }),
      0,
      5,
    );
    expect(status).toBe("ok");
    expect(statusMessage).toMatch(/fødselsdato/);
  });

  it("bøyer entall riktig", () => {
    const { statusMessage } = summariseStatus(
      coverage({ productionDays: 2, daysWithShifts: 1, daysMissingShifts: [{ id: "d3", date: "2027-03-17" }] }),
      0,
      3,
    );
    expect(statusMessage).toMatch(/1 opptaksdag mangler/);
  });
});
