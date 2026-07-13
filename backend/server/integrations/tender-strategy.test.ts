import { describe, expect, it } from "vitest";

import { buildTenderFacts, validateBriefCitations } from "./tender-strategy.js";

const row = {
  id: "e1",
  title: "Rammeavtale videoanimasjonstjenester",
  url: "https://www.doffin.no/notices/2026-1",
  published_at: "2026-07-06",
  matched_topic: "CreatorHub — fotografer og videografer",
  raw: {
    deadline: "2026-08-17",
    valueNok: 30_000_000,
    buyerName: "Skyss",
    cpvCodes: ["79961000"],
    description: "Kontrakt med fullservicebyrå...",
    requirements: ["rammeavtale", "miljo"],
  },
};

describe("buildTenderFacts", () => {
  it("nummererer kun felter som finnes, med norske krav-etiketter", () => {
    const facts = buildTenderFacts(row);
    expect(facts.map((f) => f.label)).toContain("Frist");
    expect(facts.find((f) => f.label.startsWith("Krav"))!.value).toBe("Rammeavtale, Miljøkrav");
    expect(facts[0].n).toBe(1);
  });

  it("tomme felter blir ALDRI fakta", () => {
    const thin = buildTenderFacts({ ...row, raw: null });
    expect(thin.map((f) => f.label)).toEqual(["Tittel", "Publisert", "Kunngjørings-URL"]);
  });
});

describe("buildTenderFacts med kontekst", () => {
  it("profil-fit og konkurransetrykk blir fakta når de finnes", () => {
    const facts = buildTenderFacts(row, {
      capabilities: { miljo: true },
      industryPlayers: { count: 8961, segment: "Fotografer (74.200)" },
    });
    const fit = facts.find((f) => f.label.startsWith("Egen leveranseprofil"))!;
    expect(fit.value).toContain("HAR: Miljøkrav");
    expect(facts.find((f) => f.label.startsWith("Registrerte aktører"))!.value).toContain("8961");
  });

  it("uten kontekst: ingen fit-fakta (aldri gjettet profil)", () => {
    const facts = buildTenderFacts(row);
    expect(facts.find((f) => f.label.startsWith("Egen leveranseprofil"))!.value).toContain("UBESVART");
  });
});

describe("validateBriefCitations", () => {
  const facts = buildTenderFacts(row);

  it("godtar brief med gyldige siteringer", () => {
    expect(validateBriefCitations("Skyss [2] lyser ut rammeavtale [1] med frist [4].", facts)).toBe(true);
  });

  it("forkaster fabrikkert referanse og for få siteringer", () => {
    expect(validateBriefCitations("Krav om ISO 27001 [99] og frist [4].", facts)).toBe(false);
    expect(validateBriefCitations("Bare én sitering [1].", facts)).toBe(false);
  });
});
