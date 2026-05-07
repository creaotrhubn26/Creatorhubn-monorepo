/**
 * role-room-investor-deck-template.ts
 *
 * Hardcoded "investor-pitch-v1" template — the 8 sections Daniel
 * specified for Investor Room (2026-05-07):
 *   1. Problem
 *   2. Løsning
 *   3. Marked
 *   4. Forretningsmodell
 *   5. Konkurranse
 *   6. Traction
 *   7. Team
 *   8. Finansiering
 *
 * The template owns Norwegian-language Claude prompts per section so
 * the assistant generates content in the brand's voice without each
 * caller re-engineering the prompt.
 */

export type InvestorSection =
  | "cover"
  | "problem"
  | "solution"
  | "market"
  | "business_model"
  | "competition"
  | "traction"
  | "team"
  | "funding"
  | "cta";

export interface InvestorSectionDef {
  section: InvestorSection;
  position: number;
  title: string; // Default Norwegian heading
  prompt: string; // Claude prompt asking for content in Norwegian
  placeholder: string; // Text shown in UI when empty
  required: boolean; // Cover, problem, solution, funding are non-skippable
}

export const INVESTOR_PITCH_V1: InvestorSectionDef[] = [
  {
    section: "cover",
    position: 0,
    title: "Forside",
    prompt:
      "Skriv en 1-linjers forretningsbeskrivelse på maks 12 ord som åpner et investor-pitch. Tonefall: konkret, ikke hype. Returner kun setningen, ingen anførselstegn.",
    placeholder: "Selskapsnavn + 1-linjers forretningsbeskrivelse",
    required: true,
  },
  {
    section: "problem",
    position: 1,
    title: "Problem",
    prompt:
      "Skriv en seksjon (3-5 punktlinjer) som beskriver problemet selskapet løser. Hver linje skal være konkret med data eller eksempel hvis mulig. Tonefall: norsk forretnings-stil, formell, datadrevet, ingen hype-ord. Returner Markdown-bullets.",
    placeholder: "Hvilket problem løser du? Hvem rammes? Hvor stort er det?",
    required: true,
  },
  {
    section: "solution",
    position: 2,
    title: "Løsning",
    prompt:
      "Beskriv produktet/tjenesten i 3-5 punktlinjer. Forklar hva det gjør, hvordan det fungerer kort, og hvorfor det er bedre enn alternativene. Norsk, datadrevet. Returner Markdown-bullets.",
    placeholder: "Hva er produktet/tjenesten? Hvordan fungerer det?",
    required: true,
  },
  {
    section: "market",
    position: 3,
    title: "Marked",
    prompt:
      "Beskriv markedsmuligheten med TAM/SAM/SOM-tall hvis tilgjengelig. 3-5 punktlinjer. Inkluder vekstrate og hvor i markedet dere starter. Norsk, formelt. Returner Markdown-bullets.",
    placeholder: "Hvor stort er markedet? TAM/SAM/SOM, vekstrate, segment",
    required: true,
  },
  {
    section: "business_model",
    position: 4,
    title: "Forretningsmodell",
    prompt:
      "Forklar hvordan selskapet tjener penger. 3-5 punktlinjer som dekker pris-modell, gjennomsnittlig kontraktsverdi, marginer hvis relevant. Norsk, formelt. Returner Markdown-bullets.",
    placeholder: "Hvordan tjener du penger? Pris, ARPU, margin",
    required: true,
  },
  {
    section: "competition",
    position: 5,
    title: "Konkurranse",
    prompt:
      "List 3-5 hovedkonkurrenter eller konkurrent-kategorier. For hver: ett-linjers beskrivelse + hva som gjør deres tilbud annerledes. Avslutt med 1 linje som oppsummerer USP. Norsk, formelt. Returner Markdown-bullets.",
    placeholder: "Hvem konkurrerer du med? Hva gjør deg unik?",
    required: true,
  },
  {
    section: "traction",
    position: 6,
    title: "Traction",
    prompt:
      "Beskriv resultater så langt med konkrete tall. Inkluder: brukere/kunder, omsetning, vekst MoM/YoY, nøkkel-metric for forretningen. 3-5 punktlinjer. Norsk, formelt. Returner Markdown-bullets.",
    placeholder: "Resultater så langt: brukere, salg, vekst, nøkkel-KPI",
    required: false,
  },
  {
    section: "team",
    position: 7,
    title: "Team",
    prompt:
      "Beskriv teamet i 3-5 punktlinjer. For hver gründer/nøkkelperson: navn, rolle, og 1 setning om relevant erfaring. Hvis det er åpne nøkkelroller, list dem til slutt. Norsk, formelt. Returner Markdown-bullets.",
    placeholder: "Hvem står bak? Gründere, nøkkel-erfaring, åpne roller",
    required: true,
  },
  {
    section: "funding",
    position: 8,
    title: "Finansiering",
    prompt:
      "Beskriv hvor mye penger dere søker, til hvilken pris/cap (hvis SAFE), hvor mye runway det gir, og hva pengene skal brukes til (3-4 hoved-buckets med prosent). Norsk, formelt. Returner Markdown-bullets.",
    placeholder: "Hvor mye søker du? Til hva? Runway? Use of funds",
    required: true,
  },
  {
    section: "cta",
    position: 9,
    title: "Kontakt / CTA",
    prompt:
      "Skriv en kort avslutnings-slide: 1 setning som oppfordrer til neste steg + kontakt-info-placeholder. Norsk, profesjonelt.",
    placeholder: "Kontakt + CTA",
    required: true,
  },
];

export function getSectionDef(section: InvestorSection): InvestorSectionDef | undefined {
  return INVESTOR_PITCH_V1.find((s) => s.section === section);
}

/** Initial empty slide-content for a new investor deck. */
export function initialInvestorDeckSlides(): Array<{
  section: InvestorSection;
  position: number;
  layout: string;
  content: { heading: string; body: string };
}> {
  return INVESTOR_PITCH_V1.map((def) => ({
    section: def.section,
    position: def.position,
    layout: def.section === "cover" ? "title" : def.section === "cta" ? "cta" : "standard",
    content: { heading: def.title, body: "" },
  }));
}
