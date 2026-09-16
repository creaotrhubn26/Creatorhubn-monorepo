/**
 * CV-import — deterministisk uttrekk, ingen AI.
 *
 * Testene holder på to ting:
 *   1. Vanlige oppsett av norske og engelske skuespiller-CV-er gjenkjennes.
 *   2. Persondata og overskrifter blir ALDRI krediteringer. En falsk rolle i
 *      registeret er verre enn en manglende, fordi byrået tror på den.
 */

import { describe, expect, it } from "vitest";

import {
  parseCreditLine,
  parseCvText,
  stripPersonalNumbers,
} from "./role-room-talent-cv-import.js";

describe("linjegjenkjenning", () => {
  it("leser år, produksjon, selskap, regi og rolle fra en tabell-linje", () => {
    const credit = parseCreditLine(
      "2024 | Hamlet | Nationaltheatret | Regi: Eirik Stubø | Horatio",
      "theatre",
    );

    expect(credit).toMatchObject({
      category: "theatre",
      title: "Hamlet",
      production_company: "Nationaltheatret",
      director: "Eirik Stubø",
      year: 2024,
    });
    expect(credit?.role_name).toBe("Horatio");
  });

  it("takler engelsk oppsett med director og lead", () => {
    const credit = parseCreditLine(
      "The Hollow Sky · BBC · Director: Sarah Lane · Lead · 2023",
      "film_tv",
    );

    expect(credit).toMatchObject({
      title: "The Hollow Sky",
      production_company: "BBC",
      director: "Sarah Lane",
      role_type: "lead",
      year: 2023,
    });
  });

  it("gjetter ikke på årstall som ikke finnes", () => {
    const credit = parseCreditLine("Ukjent produksjon | Teater Ibsen | Birolle", "theatre");
    expect(credit?.year).toBeNull();
    expect(credit?.role_type).toBe("supporting");
  });

  it("avviser løpende tekst uten årstall og uten struktur", () => {
    expect(
      parseCreditLine("Jeg er en engasjert skuespiller som liker å jobbe med mennesker", "film_tv"),
    ).toBeNull();
  });

  it("avviser for korte linjer", () => {
    expect(parseCreditLine("CV", "film_tv")).toBeNull();
  });

  it("forkaster årstall utenfor rimelig intervall", () => {
    const credit = parseCreditLine("Middelalderspillet | Teatret | 1350", "theatre");
    expect(credit?.year).toBeNull();
  });
});

describe("fødselsnummer", () => {
  it("fjernes fra en enkeltverdi", () => {
    expect(stripPersonalNumbers("Hamlet 01019012345")).toBe("Hamlet");
    expect(stripPersonalNumbers("010190 12345 Nora")).toBe("Nora");
    expect(stripPersonalNumbers("010190-12345")).toBe("");
  });

  it("havner aldri i en kreditering, selv midt i en gyldig linje", () => {
    const credit = parseCreditLine(
      "2024 | Hamlet 01019012345 | Nationaltheatret | Horatio",
      "theatre",
    );
    expect(JSON.stringify(credit)).not.toContain("01019012345");
  });

  it("rører ikke årstall eller vanlige tall", () => {
    const credit = parseCreditLine("2024 | Hamlet | Nationaltheatret | Horatio", "theatre");
    expect(credit?.year).toBe(2024);
    expect(credit?.title).toBe("Hamlet");
  });
});

describe("hele CV-en", () => {
  const cv = `
KARI NORDMANN
Skuespiller
kari@eksempel.no
Tlf: +47 900 00 000
Adresse: Storgata 1, Oslo

UTDANNING
Teaterhøgskolen, KHiO — 2018-2021

FILM & TV
2024 | Nattbussen | NRK | Regi: Ola Hansen | Hovedrolle
2022 | Vinterlys | Maipo Film | Regi: Siri Berg | Birolle

TEATER
2023 | Et dukkehjem | Det Norske Teatret | Regi: Kjersti Horn | Nora
2021 | Peer Gynt | Nationaltheatret | Ensemble
`;

  it("plukker krediteringer i riktig kategori", () => {
    const result = parseCvText(cv);
    const titles = result.credits.map((c) => c.title);

    expect(titles).toContain("Nattbussen");
    expect(titles).toContain("Et dukkehjem");

    const nattbussen = result.credits.find((c) => c.title === "Nattbussen");
    expect(nattbussen?.category).toBe("film_tv");
    expect(nattbussen?.director).toBe("Ola Hansen");
    expect(nattbussen?.role_type).toBe("lead");

    const dukkehjem = result.credits.find((c) => c.title === "Et dukkehjem");
    expect(dukkehjem?.category).toBe("theatre");
    expect(dukkehjem?.production_company).toBe("Det Norske Teatret");
  });

  it("henter dramaskole uten å gjøre den til en kreditering", () => {
    const result = parseCvText(cv);
    expect(result.profile.drama_school).toContain("Teaterhøgskolen");
    expect(result.credits.map((c) => c.title)).not.toContain("Teaterhøgskolen, KHiO");
  });

  it("lagrer aldri persondata, men melder fra om dem", () => {
    const result = parseCvText(cv);
    const serialized = JSON.stringify(result.credits);

    expect(serialized).not.toContain("kari@eksempel.no");
    expect(serialized).not.toContain("900 00 000");
    expect(serialized).not.toContain("Storgata");
    expect(result.skipped).toContain("e-post");
    expect(result.skipped).toContain("adresse");
  });

  it("gjør ikke seksjonsoverskrifter til krediteringer", () => {
    const result = parseCvText(cv);
    const titles = result.credits.map((c) => c.title.toLowerCase());
    expect(titles).not.toContain("film & tv");
    expect(titles).not.toContain("teater");
    expect(titles).not.toContain("utdanning");
  });

  it("er deterministisk — samme fil gir samme resultat", () => {
    expect(parseCvText(cv)).toEqual(parseCvText(cv));
  });
});
