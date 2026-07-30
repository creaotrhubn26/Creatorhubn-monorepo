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
