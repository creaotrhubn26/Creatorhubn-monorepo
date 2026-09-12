import { describe, expect, it } from "vitest";

import { namesMatchForAutoLink } from "./lead-brreg-service.js";

describe("namesMatchForAutoLink (match-vakten for auto-kobling)", () => {
  it("godtar samme navn med/uten org-form og casing", () => {
    expect(namesMatchForAutoLink("Foto Hansen", "FOTO HANSEN AS")).toBe(true);
    expect(namesMatchForAutoLink("Bergen Dansestudio AS", "Bergen Dansestudio")).toBe(true);
  });

  it("avviser vage/korte treff — heller uberiket enn feilkoblet", () => {
    expect(namesMatchForAutoLink("Hansen", "Hansen Bygg og Anlegg AS")).toBe(false); // < 5 tegn normalisert
    expect(namesMatchForAutoLink("Nordlys Foto", "Nordlys Transport AS")).toBe(false);
    expect(namesMatchForAutoLink("Kunde", "")).toBe(false);
  });

  it("delstreng-innhold godtas begge veier", () => {
    expect(namesMatchForAutoLink("Studio Nord Foto", "Studio Nord Foto og Video AS")).toBe(true);
  });
});
