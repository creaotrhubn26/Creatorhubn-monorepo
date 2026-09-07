import { describe, expect, it } from "vitest";

import { buildLeadPitchPrompt } from "./lead-map-service.js";

describe("Leadgrid campaign-aware pitch prompt", () => {
  const lead = {
    name: "Sentrum Tannklinikk AS",
    company: "Sentrum Tannklinikk AS",
    category: "dental_clinic",
    status: "unvisited" as const,
    address: "Storgata 1",
    city: "Oslo",
    googleRating: 4.6,
    notes: "Uavhengig klinikk",
    websiteUrl: "https://klinikk.example",
    instagramUrl: null,
    lastVisitAt: null,
  };

  it("uses the campaign offer and never assumes The Role Room is being sold", () => {
    const prompt = buildLeadPitchPrompt({
      lead,
      serviceFocus: "Dentum-pilot med verifisert klinikkprofil",
    });

    expect(prompt).toContain("Dentum-pilot med verifisert klinikkprofil");
    expect(prompt).toContain("Leadgrid er kun arbeidsverktøyet");
    expect(prompt).toContain("Ikke selg Leadgrid");
    expect(prompt).not.toContain("basert på match med The Role Rooms tjenester");
  });

  it("fails safely when the campaign offer is missing", () => {
    const prompt = buildLeadPitchPrompt({ lead });

    expect(prompt).toContain("Tilbudet er ikke oppgitt");
    expect(prompt).toContain("må avklares før utsendelse");
    expect(prompt).toContain("ubetrodd faktagrunnlag");
  });
});
