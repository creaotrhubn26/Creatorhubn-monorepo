import { describe, expect, it } from "vitest";
import {
  chunkContextText,
  rankContextCandidates,
  type ContextCandidate,
} from "./admin-document-context-service";

describe("admin document context service", () => {
  it("bevarer seksjoner og deler lange dokumenter i sporbare utdrag", () => {
    const chunks = chunkContextText([
      "# Daniel Qazi",
      "## Erfaring",
      "Daniel har lang erfaring fra salg, markedsføring, innholdsproduksjon og IT.",
      "## Utdanning",
      "Relevant teknisk og kommersiell bakgrunn.",
    ].join("\n\n"));

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((chunk) => chunk.sectionLabel === "Erfaring")).toBe(true);
    expect(chunks.every((chunk) => chunk.contentHash.length === 64)).toBe(true);
  });

  it("rangerer en CV foran irrelevant materiale i en teamseksjon", () => {
    const candidates: ContextCandidate[] = [
      {
        sourceType: "file",
        sourceDocumentId: "document-cv",
        sourceFileId: "file-cv",
        sourceProjectFileId: null,
        sourceTitle: "Daniel Qazi CV.pdf",
        originDocumentTitle: "Selskapsdokumenter",
        sectionLabel: "Erfaring",
        pageNumber: 1,
        chunkIndex: 0,
        content: "Daniel Qazi har lang erfaring fra salg, markedsføring, innholdsproduksjon, IT og teknisk produktutvikling.",
      },
      {
        sourceType: "workspace_document",
        sourceDocumentId: "document-budget",
        sourceFileId: null,
        sourceProjectFileId: null,
        sourceTitle: "Budsjett",
        originDocumentTitle: "Budsjett",
        sectionLabel: "Kostnader",
        pageNumber: null,
        chunkIndex: 0,
        content: "Programvare 50 000 kroner. Markedsavklaring 80 000 kroner.",
      },
    ];

    const suggestions = rankContextCandidates(candidates, {
      documentTitle: "Oppstartstilskudd 1 — Leadgrid",
      documentType: "funding_application",
      sectionHeading: "Team og gjennomføringsevne",
      selectedText: null,
      nearbyText: "Beskriv teamets kompetanse og relevante erfaring.",
      currentDocumentContent: "# Team og gjennomføringsevne\n\n[MÅ FYLLES UT]",
    });

    expect(suggestions[0]?.sourceTitle).toBe("Daniel Qazi CV.pdf");
    expect(suggestions[0]?.matchedTerms).toContain("erfaring");
    expect(suggestions[0]?.excerpt).toContain("markedsføring");
  });

  it("foreslår ikke et utdrag som allerede finnes i dokumentet", () => {
    const content = "Daniel har erfaring fra salg, markedsføring og IT, og arbeider operativt med produktet på fulltid. Dette er dokumentert i teamets CV.";
    const suggestions = rankContextCandidates([
      {
        sourceType: "file",
        sourceDocumentId: "document-cv",
        sourceFileId: "file-cv",
        sourceProjectFileId: null,
        sourceTitle: "CV.txt",
        originDocumentTitle: "Team",
        sectionLabel: "Erfaring",
        pageNumber: null,
        chunkIndex: 0,
        content,
      },
    ], {
      documentTitle: "Søknad",
      documentType: "funding_application",
      sectionHeading: "Team og gjennomføringsevne",
      selectedText: null,
      nearbyText: "team erfaring",
      currentDocumentContent: `# Team\n\n${content}`,
    });

    expect(suggestions).toEqual([]);
  });

  it("forstår relevante norske sammensatte ord i prosjektfiler", () => {
    const suggestions = rankContextCandidates([
      {
        sourceType: "project_file",
        sourceDocumentId: null,
        sourceFileId: null,
        sourceProjectFileId: "project-file-1",
        sourceTitle: "kundeintervju.txt",
        originDocumentTitle: "Prosjekt: Markedsavklaring",
        sectionLabel: null,
        pageNumber: null,
        chunkIndex: 0,
        content: "Fem pilotkunder beskriver manuell leadoppfølging som tidkrevende og ønsker tydelig eierskap.",
      },
    ], {
      documentTitle: "Søknad",
      documentType: "funding_application",
      sectionHeading: "Markedsbehov og kundeinnsikt",
      selectedText: null,
      nearbyText: "Beskriv markedet og kundenes behov.",
      currentDocumentContent: "# Markedsbehov og kundeinnsikt\n\n[MÅ FYLLES UT]",
    });

    expect(suggestions[0]?.sourceType).toBe("project_file");
    expect(suggestions[0]?.sourceProjectFileId).toBe("project-file-1");
    expect(suggestions[0]?.matchedTerms).toEqual(expect.arrayContaining(["kunde", "pilot"]));
  });

  it("prioriterer aktiv seksjon foran støy fra forrige lange seksjon", () => {
    const suggestions = rankContextCandidates([
      {
        sourceType: "file",
        sourceDocumentId: "application",
        sourceFileId: "cost-source",
        sourceProjectFileId: null,
        sourceTitle: "kostnadsgrunnlag.md",
        originDocumentTitle: "Søknad",
        sectionLabel: "Foreslått kostnadsramme",
        pageNumber: null,
        chunkIndex: 0,
        content: "Eksterne kostnader, arbeidstid, merverdiavgift, leverandører, egen finansiering og prosjektstart etter tilsagn.",
      },
      {
        sourceType: "project_file",
        sourceDocumentId: null,
        sourceFileId: null,
        sourceProjectFileId: "linkedin-cv",
        sourceTitle: "Daniel-Qazi-LinkedIn-CV.txt",
        originDocumentTitle: "Prosjekt: Oppstartstilskudd",
        sectionLabel: "Profil og kompetanse",
        pageNumber: null,
        chunkIndex: 0,
        content: "Daniel har erfaring fra IT, salg, markedsføring, videoproduksjon, ledelse og teknisk gjennomføring.",
      },
    ], {
      documentTitle: "Oppstartstilskudd 1",
      documentType: "funding_application",
      sectionHeading: "7. Team og gjennomføringsevne",
      selectedText: null,
      nearbyText: "Eksterne kostnader og merverdiavgift må bekreftes. CV for Daniel med roller, årstall og dokumenterbare resultater.",
      currentDocumentContent: "# Søknad\n\n## 7. Team og gjennomføringsevne\n\n[MÅ FYLLES UT]",
    });

    expect(suggestions[0]?.sourceProjectFileId).toBe("linkedin-cv");
    expect(suggestions[0]?.matchedTerms).toEqual(
      expect.arrayContaining(["erfaring", "kompetanse"]),
    );
  });
});
