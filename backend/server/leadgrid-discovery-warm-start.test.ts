import { describe, expect, it } from "vitest";

import {
  candidateIsMapReady,
  nextWorkingMorning,
  pickWarmestCandidate,
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

function lagKandidat(
  id: string,
  fit: number,
  extra: Partial<{
    phone: string | null;
    email: string | null;
    latitude: number | null;
    longitude: number | null;
  }> = {},
) {
  return {
    id,
    name: id,
    city: "Oslo",
    organization_number: null,
    phone: null,
    email: null,
    website_url: null,
    latitude: 59.91,
    longitude: 10.75,
    fit_score: fit,
    reasons: [],
    ...extra,
  } as never;
}

describe("pickWarmestCandidate", () => {
  // Scorene her er 0-100, samme skala som basen faktisk bruker. Testene sto
  // tidligere på 0-1 og passerte mens produksjonsatferden var feil.
  it("velger den best scorende når alle er like brukbare", () => {
    const valgt = pickWarmestCandidate([
      lagKandidat("a", 70, { phone: "1" }),
      lagKandidat("b", 90, { phone: "1" }),
    ]);
    expect(valgt?.id).toBe("b");
  });

  it("velger den vi kan kontakte når scoren er jevn", () => {
    // Den best scorende mangler både telefon og e-post. Førstehandlingen
    // ville blitt «finn kontaktinfo selv». 89 mot 86 er innenfor slingringen.
    const valgt = pickWarmestCandidate([
      lagKandidat("stor-uten-kontakt", 89),
      lagKandidat("litt-lavere-med-telefon", 86, { phone: "94 89 78 64" }),
    ]);
    expect(valgt?.id).toBe("litt-lavere-med-telefon");
  });

  it("velger den som kan plasseres på kartet framfor en uten koordinater", () => {
    const valgt = pickWarmestCandidate([
      lagKandidat("uten-kart", 88, { phone: "1", latitude: null, longitude: null }),
      lagKandidat("med-kart", 85, { phone: "1" }),
    ]);
    expect(valgt?.id).toBe("med-kart");
  });

  it("lar treffsikkerheten vinne når forskjellen er stor", () => {
    // 60 mot 89 er ikke «jevnt». Da er ikke et telefonnummer nok.
    const valgt = pickWarmestCandidate([
      lagKandidat("riktig-bransje", 89),
      lagKandidat("feil-bransje-med-telefon", 60, { phone: "1" }),
    ]);
    expect(valgt?.id).toBe("riktig-bransje");
  });

  it("bruker hele slingringsmonnet på ekte score-spenn", () => {
    // Produksjon 2026-09-23: 60 kandidater mellom 60 og 89. Med den gamle
    // toleransen på 0,1 var kontaktbarhet uten virkning her.
    const valgt = pickWarmestCandidate([
      lagKandidat("topp-uten-kontakt", 89),
      lagKandidat("nest-med-kontakt", 84.5, { phone: "32 24 26 80" }),
    ]);
    expect(valgt?.id).toBe("nest-med-kontakt");
  });

  it("gir null på tom liste", () => {
    expect(pickWarmestCandidate([])).toBeNull();
  });

  it("tåler at scoren mangler", () => {
    const valgt = pickWarmestCandidate([
      lagKandidat("uten-score", Number.NaN as unknown as number),
      lagKandidat("med-score", 50, { phone: "1" }),
    ]);
    expect(valgt).not.toBeNull();
  });
});

describe("candidateIsMapReady", () => {
  it("regner 0,0 som ingen plassering", () => {
    // Kartlaget filtrerer bort 0,0; en pin i Atlanterhavet er ingen pin.
    expect(candidateIsMapReady({ latitude: 0, longitude: 0 })).toBe(false);
  });

  it("godtar ekte koordinater", () => {
    expect(candidateIsMapReady({ latitude: 59.91, longitude: 10.75 })).toBe(true);
  });

  it("krever begge", () => {
    expect(candidateIsMapReady({ latitude: 59.91, longitude: null })).toBe(false);
  });
});
