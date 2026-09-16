/**
 * CV-import.
 *
 * Det som holdes fast: forslaget fra modellen er et FORSLAG, og det
 * normaliseres mot nøyaktig samme regler som skrive-endepunktene. En modell
 * skal aldri kunne foreslå en verdi brukeren ikke kunne lagret selv — og
 * aldri foreslå persondata som ikke hører hjemme i et casting-register.
 */

import { describe, expect, it } from "vitest";

import { normalizeSuggestion } from "./role-room-talent-cv-import.js";

describe("normalisering av CV-forslag", () => {
  it("beholder gyldige krediteringer", () => {
    const result = normalizeSuggestion({
      credits: [
        {
          category: "theatre",
          title: "Hamlet",
          role_name: "Horatio",
          role_type: "supporting",
          production_company: "Nationaltheatret",
          director: "Eirik Stubø",
          year: 2024,
        },
      ],
      profile: {},
    });

    expect(result.credits).toHaveLength(1);
    expect(result.credits[0]).toMatchObject({
      category: "theatre",
      title: "Hamlet",
      role_type: "supporting",
      year: 2024,
    });
  });

  it("forkaster krediteringer uten tittel", () => {
    const result = normalizeSuggestion({
      credits: [{ role_name: "Ukjent rolle", year: 2020 }],
      profile: {},
    });
    expect(result.credits).toHaveLength(0);
  });

  it("faller tilbake til other for ukjent kategori, og null for ukjent rolletype", () => {
    const result = normalizeSuggestion({
      credits: [{ title: "Noe", category: "musikkvideo", role_type: "hovedrolle" }],
      profile: {},
    });

    expect(result.credits[0].category).toBe("other");
    expect(result.credits[0].role_type).toBeNull();
  });

  it("forkaster årstall utenfor rimelig intervall", () => {
    const result = normalizeSuggestion({
      credits: [
        { title: "Middelalderspill", year: 1350 },
        { title: "Framtidsfilm", year: 2199 },
      ],
      profile: {},
    });

    expect(result.credits[0].year).toBeNull();
    expect(result.credits[1].year).toBeNull();
  });

  it("melder fra om persondata modellen tok med, uten å foreslå dem", () => {
    const result = normalizeSuggestion({
      credits: [],
      profile: {
        display_name: "Kari Nordmann",
        email: "kari@eksempel.no",
        phone: "+47 900 00 000",
        birth_date: "1990-01-01",
        city: "Oslo",
      },
    });

    expect(result.profile.display_name).toBe("Kari Nordmann");
    expect(result.profile.city).toBe("Oslo");
    expect(result.skipped).toContain("email");
    expect(result.skipped).toContain("phone");
    expect(result.skipped).toContain("birth_date");
    // Persondataene finnes ikke i forslaget som skal lagres.
    expect(JSON.stringify(result.profile)).not.toContain("kari@eksempel.no");
    expect(JSON.stringify(result.profile)).not.toContain("900 00 000");
  });

  it("kapper bio og begrenser lister", () => {
    const result = normalizeSuggestion({
      credits: [],
      profile: {
        bio: "a".repeat(2000),
        skills: Array.from({ length: 80 }, (_, i) => `ferdighet ${i}`),
      },
    });

    expect(result.profile.bio?.length).toBe(600);
    expect(result.profile.skills.length).toBe(25);
  });

  it("takler at modellen returnerer tull i stedet for lister", () => {
    const result = normalizeSuggestion({
      credits: "ikke en liste",
      profile: { skills: "scenekamp, sang" },
    });

    expect(result.credits).toEqual([]);
    expect(result.profile.skills).toEqual([]);
  });
});
