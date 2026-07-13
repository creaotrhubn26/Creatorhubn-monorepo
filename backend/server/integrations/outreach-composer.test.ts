import { describe, expect, it } from "vitest";

import {
  analyzeOutreachText,
  buildDossierFacts,
  validateButlerNotes,
} from "./outreach-composer.js";

const lead = {
  id: "l1",
  name: "Foto Hansen AS",
  pipeline_stage: "qualified",
  deal_amount: null,
  enrichment_data: {
    company: { naceDescription: "Fotografvirksomhet", employees: 4, city: "BERGEN", registeredAt: "2018-03-01" },
    financials: { year: 2025, revenue: 3_400_000, operatingMargin: 0.12, equityRatio: 0.41 },
    ip: { trademarks: 2, patents: 0, designs: 0 },
    contacts: [{ role: "Daglig leder", name: "Kari Hansen" }],
  },
};

describe("buildDossierFacts", () => {
  it("bygger nummerert dossier fra berikelse + triggere — kun felter som finnes", () => {
    const facts = buildDossierFacts(lead, [
      { kind: "strategy_media", title: "Foto Hansen satser på video", published_at: "2026-07-10" },
    ]);
    const labels = facts.map((f) => f.label);
    expect(labels).toContain("Omsetning 2025");
    expect(labels).toContain("IP-aktivitet");
    expect(labels.some((l) => l.startsWith("Nylig hendelse"))).toBe(true);
    expect(facts[0].n).toBe(1);
  });

  it("tomt lead gir minimalt dossier (navn + pipeline), aldri oppdiktede felter", () => {
    const facts = buildDossierFacts({ ...lead, enrichment_data: null }, []);
    expect(facts.map((f) => f.label)).toEqual(["Selskap", "Deres relasjon (pipeline)"]);
  });
});

describe("analyzeOutreachText (deterministisk ryddighet)", () => {
  it("flagger lengde, manglende hilsen/CTA og jeg-tunghet", () => {
    const a = analyzeOutreachText("Jeg vil selge dere noe. Jeg har et produkt. Jeg er best i markedet.");
    expect(a.warnings.join(" ")).toContain("hilsen");
    expect(a.iHeavyPct).toBe(100);
    expect(a.hasCallToAction).toBe(false);
  });

  it("godkjenner ryddig tekst med hilsen og neste steg", () => {
    const a = analyzeOutreachText("Hei Kari. Så at dere satser på video. Passer det med en kort prat torsdag?");
    expect(a.hasGreeting).toBe(true);
    expect(a.hasCallToAction).toBe(true);
    expect(a.warnings).toEqual([]);
  });
});

describe("validateButlerNotes", () => {
  const facts = buildDossierFacts(lead, []);

  it("selskaps-råd uten sitering eller med fabrikkert [n] forkastes", () => {
    expect(validateButlerNotes([{ kind: "selskap", note: "De vokser — nevn det." }], facts)).toBe(false);
    expect(validateButlerNotes([{ kind: "selskap", note: "De vokser [99]." }], facts)).toBe(false);
    expect(validateButlerNotes([{ kind: "selskap", note: "Solid drift [4] — anerkjenn det." }], facts)).toBe(true);
  });

  it("stil-råd trenger ikke sitering", () => {
    expect(validateButlerNotes([{ kind: "stil", note: "Kutt tredje avsnitt." }], facts)).toBe(true);
  });
});
