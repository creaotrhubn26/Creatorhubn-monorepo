import { describe, it, expect } from "vitest";
import {
  ageOn,
  evaluateWorkTime,
  isoWeekKey,
  restBetween,
  shiftHours,
  touchesClockWindow,
  type Shift,
} from "./role-room-work-time-rules.js";

/** Vakt på en gitt dato, lokal tid. */
const shift = (date: string, from: string, to: string, extra: Partial<Shift> = {}): Shift => ({
  callTime: `${date}T${from}:00`,
  wrapTime: `${date}T${to}:00`,
  ...extra,
});

const codes = (r: { findings: Array<{ code: string }> }) => r.findings.map((f) => f.code);

describe("shiftHours", () => {
  it("trekker fra pause — pause er ikke arbeidstid", () => {
    expect(shiftHours(shift("2026-08-15", "08", "18", { breakMinutes: 60 }))).toBe(9);
  });

  it("er 0 for ugyldig rekkefølge", () => {
    expect(shiftHours(shift("2026-08-15", "18", "08"))).toBe(0);
  });

  it("blir aldri negativ av urimelig lang pause", () => {
    expect(shiftHours(shift("2026-08-15", "08", "10", { breakMinutes: 600 }))).toBe(0);
  });
});

describe("restBetween", () => {
  it("regner hvile mellom to vakter", () => {
    expect(restBetween(shift("2026-08-15", "08", "22"), shift("2026-08-16", "08", "18"))).toBe(10);
  });
});

describe("touchesClockWindow", () => {
  it("fanger vindu som krysser midnatt", () => {
    // 23:00–06:00 er nattarbeidsforbudet for under 18.
    expect(touchesClockWindow(shift("2026-08-15", "20", "23:30" as string), 23, 6)).toBe(true);
    expect(touchesClockWindow(shift("2026-08-15", "08", "18"), 23, 6)).toBe(false);
  });

  it("fanger kveldsvindu for grunnskolepliktige", () => {
    expect(touchesClockWindow(shift("2026-08-15", "16", "21"), 20, 6)).toBe(true);
    expect(touchesClockWindow(shift("2026-08-15", "16", "19"), 20, 6)).toBe(false);
  });
});

// ── Voksne, AML kap. 10 ─────────────────────────────────────────────────────

describe("voksne", () => {
  const adult = { name: "Kari", ageAtShoot: 34 };

  it("godtar en vanlig 9-timersdag uten funn", () => {
    const r = evaluateWorkTime(adult, [shift("2026-08-15", "08", "17:30" as string, { breakMinutes: 30 })]);
    expect(r.violations).toBe(0);
    expect(codes(r)).not.toContain("overtime");
  });

  it("melder overtid over 9 timer", () => {
    const r = evaluateWorkTime(adult, [shift("2026-08-15", "07", "18", { breakMinutes: 60 })]);
    expect(codes(r)).toContain("overtime");
    expect(r.findings.find((f) => f.code === "overtime")?.reference).toContain("10-4");
  });

  it("er brudd over 13 timer samlet", () => {
    const r = evaluateWorkTime(adult, [shift("2026-08-15", "06", "20", { breakMinutes: 30 })]);
    const f = r.findings.find((x) => x.code === "daily_max_exceeded");
    expect(f?.severity).toBe("violation");
    expect(f?.reference).toContain("10-6");
  });

  it("advarer like under 13-timersgrensen", () => {
    const r = evaluateWorkTime(adult, [shift("2026-08-15", "06", "18:30" as string, { breakMinutes: 0 })]);
    expect(codes(r)).toContain("daily_max_near");
  });

  it("krever pause over 5,5 time", () => {
    const r = evaluateWorkTime(adult, [shift("2026-08-15", "08", "16", { breakMinutes: 0 })]);
    const f = r.findings.find((x) => x.code === "break_missing");
    expect(f?.severity).toBe("violation");
    expect(f?.reference).toContain("10-9");
  });

  it("er brudd med under 11 timer hvile", () => {
    const r = evaluateWorkTime(adult, [
      shift("2026-08-15", "08", "22", { breakMinutes: 60 }),
      shift("2026-08-16", "07", "15", { breakMinutes: 30 }),
    ]);
    const f = r.findings.find((x) => x.code === "daily_rest_short");
    expect(f?.severity).toBe("violation");
    expect(f?.message).toMatch(/9\.0 timer hvile/);
  });

  it("godtar 8 timer hvile når skriftlig avtale er registrert", () => {
    // AML § 10-8 første ledd åpner for reduksjon til 8 timer.
    const shifts = [
      shift("2026-08-15", "08", "22", { breakMinutes: 60 }),
      shift("2026-08-16", "07", "15", { breakMinutes: 30 }),
    ];
    const uten = evaluateWorkTime({ name: "K", ageAtShoot: 34 }, shifts);
    const med = evaluateWorkTime({ name: "K", ageAtShoot: 34 }, shifts, { reducedDailyRestAgreed: true });
    expect(codes(uten)).toContain("daily_rest_short");
    // 9 timer er klar av 8-timersgrensen — verken brudd eller «like over».
    expect(codes(med)).not.toContain("daily_rest_short");
    expect(codes(med)).not.toContain("daily_rest_tight");
  });

  it("oppgir at den reduserte grensen ble brukt, ikke bare at den er nær", () => {
    // 8,5 time hvile: klar av 8-timersgrensen, men innenfor advarselssonen.
    const r = evaluateWorkTime(
      { name: "K", ageAtShoot: 34 },
      [
        shift("2026-08-15", "08", "22", { breakMinutes: 60 }),
        shift("2026-08-16", "06:30" as string, "14", { breakMinutes: 30 }),
      ],
      { reducedDailyRestAgreed: true },
    );
    expect(r.findings.find((f) => f.code === "daily_rest_tight")?.reference).toContain("skriftlig avtale");
  });

  it("advarer når hvilen er like over kravet", () => {
    const r = evaluateWorkTime(adult, [
      shift("2026-08-15", "08", "20", { breakMinutes: 60 }),
      shift("2026-08-16", "07:30" as string, "15", { breakMinutes: 30 }),
    ]);
    expect(codes(r)).toContain("daily_rest_tight");
  });

  it("er brudd over 48 timer i uka", () => {
    const shifts = ["16", "17", "18", "19", "20", "21"].map((d) =>
      shift(`2026-08-${d}`, "08", "19", { breakMinutes: 30 }),
    );
    const r = evaluateWorkTime(adult, shifts);
    const f = r.findings.find((x) => x.code === "weekly_max_exceeded");
    expect(f?.severity).toBe("violation");
    expect(f?.reference).toContain("10-6");
  });
});

// ── Barn, AML kap. 11 ───────────────────────────────────────────────────────

describe("barn under 15 / grunnskolepliktige", () => {
  const child = { name: "Ola (12)", ageAtShoot: 12, hasLabourAuthorityPermit: true };

  it("tillater maks 2 timer på skoledag", () => {
    const ok = evaluateWorkTime(child, [shift("2026-08-17", "16", "18", { isSchoolDay: true })]);
    expect(codes(ok)).not.toContain("minor_daily_max_exceeded");

    const brudd = evaluateWorkTime(child, [shift("2026-08-17", "15", "19", { isSchoolDay: true })]);
    const f = brudd.findings.find((x) => x.code === "minor_daily_max_exceeded");
    expect(f?.severity).toBe("violation");
    expect(f?.reference).toContain("11-2");
  });

  it("tillater 7 timer på skolefri dag", () => {
    const ok = evaluateWorkTime(child, [shift("2026-07-10", "09", "16")]);
    expect(codes(ok)).not.toContain("minor_daily_max_exceeded");

    const brudd = evaluateWorkTime(child, [shift("2026-07-10", "09", "17")]);
    expect(codes(brudd)).toContain("minor_daily_max_exceeded");
  });

  it("forbyr arbeid etter 20:00", () => {
    const r = evaluateWorkTime(child, [shift("2026-07-10", "17", "21")]);
    const f = r.findings.find((x) => x.code === "minor_night_work");
    expect(f?.severity).toBe("violation");
    expect(f?.reference).toContain("11-3");
  });

  it("krever 14 timer hvile", () => {
    const r = evaluateWorkTime(child, [
      shift("2026-07-10", "09", "16"),
      shift("2026-07-11", "05", "10"),
    ]);
    expect(r.findings.find((x) => x.code === "daily_rest_short")?.reference).toContain("11-5");
  });

  it("krever tillatelse fra Arbeidstilsynet", () => {
    const uten = evaluateWorkTime(
      { name: "Ola", ageAtShoot: 12, hasLabourAuthorityPermit: false },
      [shift("2026-07-10", "10", "14")],
    );
    const f = uten.findings.find((x) => x.code === "labour_authority_permit_missing");
    expect(f?.severity).toBe("violation");
    expect(f?.reference).toContain("11-1");
  });

  it("advarer når tillatelse er ukjent framfor å påstå brudd", () => {
    const r = evaluateWorkTime({ name: "Ola", ageAtShoot: 12 }, [shift("2026-07-10", "10", "14")]);
    expect(r.findings.find((x) => x.code === "labour_authority_permit_missing")?.severity).toBe("warning");
  });

  it("bruker 12-timersgrensen i skoleuker", () => {
    const shifts = ["17", "18", "19", "20", "21", "22", "23"].map((d) =>
      shift(`2026-08-${d}`, "16", "18", { isSchoolDay: true }),
    );
    const r = evaluateWorkTime(child, shifts);
    expect(r.findings.find((x) => x.code === "weekly_max_exceeded")?.message).toMatch(/12 timer/);
  });

  it("behandler grunnskolepliktig 15-åring etter det strenge settet", () => {
    // Alder alene avgjør ikke — grunnskoleplikt gjør det.
    const r = evaluateWorkTime(
      { name: "Ida", ageAtShoot: 15, inCompulsorySchooling: true, hasLabourAuthorityPermit: true },
      [shift("2026-08-17", "15", "19", { isSchoolDay: true })],
    );
    expect(r.ruleSet).toBe("minor_under_15");
    expect(codes(r)).toContain("minor_daily_max_exceeded");
  });
});

describe("ungdom 15–18 utenfor grunnskolen", () => {
  const teen = { name: "Sara (16)", ageAtShoot: 16, inCompulsorySchooling: false };

  it("tillater 8 timer", () => {
    expect(codes(evaluateWorkTime(teen, [shift("2026-08-15", "09", "17")])))
      .not.toContain("minor_daily_max_exceeded");
  });

  it("er brudd over 8 timer", () => {
    const r = evaluateWorkTime(teen, [shift("2026-08-15", "09", "19", { breakMinutes: 30 })]);
    expect(r.findings.find((x) => x.code === "minor_daily_max_exceeded")?.reference).toContain("11-2 tredje");
  });

  it("forbyr arbeid etter 23:00, men tillater kveld", () => {
    expect(codes(evaluateWorkTime(teen, [shift("2026-08-15", "14", "22")]))).not.toContain("minor_night_work");
    expect(codes(evaluateWorkTime(teen, [shift("2026-08-15", "16", "23:30" as string)]))).toContain("minor_night_work");
  });

  it("krever 12 timer hvile", () => {
    const r = evaluateWorkTime(teen, [
      shift("2026-08-15", "09", "17"),
      shift("2026-08-16", "04", "09"),
    ]);
    expect(r.findings.find((x) => x.code === "daily_rest_short")?.reference).toContain("11-5 første");
  });

  it("krever ikke Arbeidstilsynets tillatelse", () => {
    expect(codes(evaluateWorkTime(teen, [shift("2026-08-15", "09", "17")])))
      .not.toContain("labour_authority_permit_missing");
  });
});

describe("ukjent alder", () => {
  it("advarer framfor å anta voksen", () => {
    const r = evaluateWorkTime({ name: "Ukjent" }, [shift("2026-08-15", "08", "16", { breakMinutes: 30 })]);
    expect(r.ruleSet).toBe("unknown");
    expect(codes(r)).toContain("age_unknown");
    expect(r.findings.find((f) => f.code === "age_unknown")?.severity).toBe("warning");
  });
});

describe("hjelpere", () => {
  it("ageOn regner alder på opptaksdagen, ikke i dag", () => {
    // Fyller 15 midt i innspillingen — bytter regelsett underveis.
    expect(ageOn("2011-09-01", "2026-08-15")).toBe(14);
    expect(ageOn("2011-09-01", "2026-09-02")).toBe(15);
  });

  it("isoWeekKey grupperer mandag–søndag", () => {
    // 2026-08-17 er en mandag; søndag 23. hører til samme uke.
    expect(isoWeekKey(new Date(2026, 7, 17))).toBe(isoWeekKey(new Date(2026, 7, 23)));
    expect(isoWeekKey(new Date(2026, 7, 17))).not.toBe(isoWeekKey(new Date(2026, 7, 24)));
  });
});

describe("rapporten", () => {
  it("teller brudd og advarsler hver for seg", () => {
    const r = evaluateWorkTime({ name: "Kari", ageAtShoot: 34 }, [
      shift("2026-08-15", "06", "20", { breakMinutes: 0 }),
    ]);
    expect(r.violations).toBeGreaterThan(0);
    expect(r.warnings).toBeGreaterThan(0);
    expect(r.violations + r.warnings).toBe(r.findings.length);
  });

  it("gir hvert funn en paragrafhenvisning", () => {
    const r = evaluateWorkTime({ name: "Ola", ageAtShoot: 12 }, [
      shift("2026-08-17", "15", "21", { isSchoolDay: true }),
    ]);
    expect(r.findings.length).toBeGreaterThan(0);
    for (const f of r.findings) expect(f.reference).toMatch(/AML/);
  });
});
