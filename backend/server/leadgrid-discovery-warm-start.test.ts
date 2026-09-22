import { describe, expect, it } from "vitest";

import {
  nextWorkingMorning,
  warmStartFirstStep,
  warmStartSuggestionFrom,
} from "./leadgrid-discovery-warm-start.js";

const kandidat = {
  name: "Norsk Filmforbund",
  phone: null as string | null,
  email: null as string | null,
  website_url: null as string | null,
};

describe("warmStartFirstStep", () => {
  it("ringer når nummeret finnes", () => {
    expect(warmStartFirstStep({ ...kandidat, phone: "21 52 33 80" })).toEqual({
      channel: "call",
      title: "Ring Norsk Filmforbund på 21 52 33 80",
    });
  });

  it("faller til e-post når telefon mangler", () => {
    expect(
      warmStartFirstStep({ ...kandidat, email: "post@filmforbundet.no" }),
    ).toEqual({
      channel: "email",
      title: "Send første e-post til Norsk Filmforbund (post@filmforbundet.no)",
    });
  });

  it("sender deg til nettstedet når bare det finnes", () => {
    expect(
      warmStartFirstStep({ ...kandidat, website_url: "www.filmforbundet.no" }),
    ).toEqual({
      channel: "research",
      title: "Finn kontaktperson hos Norsk Filmforbund på www.filmforbundet.no",
    });
  });

  it("ber om oppslag når ingenting er kjent", () => {
    expect(warmStartFirstStep(kandidat)).toEqual({
      channel: "research",
      title: "Finn kontaktinfo for Norsk Filmforbund",
    });
  });

  it("foreslår aldri en kanal vi mangler adressen til", () => {
    // Blanke felt fra kilden skal telle som «ikke kjent», ikke som en adresse
    // vi kan ringe eller skrive til.
    const steg = warmStartFirstStep({
      ...kandidat,
      phone: "   ",
      email: "",
      website_url: "  ",
    });
    expect(steg.channel).toBe("research");
    expect(steg.title).not.toContain("()");
  });

  it("tåler en ødelagt nettadresse uten å kaste", () => {
    const steg = warmStartFirstStep({ ...kandidat, website_url: "http://" });
    expect(steg.channel).toBe("research");
  });
});

describe("warmStartSuggestionFrom", () => {
  it("tar med de tre viktigste grunnene og første steg", () => {
    const forslag = warmStartSuggestionFrom({
      id: "c1",
      name: "Skuespillerforbundet",
      city: "Oslo",
      organization_number: "871096422",
      phone: "21 02 71 90",
      email: null,
      website_url: null,
      fit_score: 0.91,
      reasons: ["Treffer næringskode 94.120", "Oslo", "12 ansatte", "Aktiv"],
    } as never);
    expect(forslag.reasons).toEqual([
      "Treffer næringskode 94.120",
      "Oslo",
      "12 ansatte",
    ]);
    expect(forslag.first_step.channel).toBe("call");
    expect(forslag.candidate_id).toBe("c1");
  });
});

describe("nextWorkingMorning", () => {
  it("legger fristen neste morgen klokka ni", () => {
    const frist = nextWorkingMorning(new Date("2026-09-22T14:35:00+02:00"));
    expect(frist.getDate()).toBe(23);
    expect(frist.getHours()).toBe(9);
    expect(frist.getMinutes()).toBe(0);
  });

  it("hopper over helga", () => {
    // Fredag → mandag. En oppgave med frist lørdag blir ikke gjort.
    const frist = nextWorkingMorning(new Date("2026-09-25T16:00:00+02:00"));
    expect(frist.getDay()).toBe(1);
    expect(frist.getDate()).toBe(28);
  });

  it("flytter aldri fristen bakover", () => {
    const now = new Date("2026-09-22T08:00:00+02:00");
    expect(nextWorkingMorning(now).getTime()).toBeGreaterThan(now.getTime());
  });
});
