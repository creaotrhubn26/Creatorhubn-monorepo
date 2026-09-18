export const OPEN_FIELD_MARKER = "[MÅ FYLLES UT]";

export interface OppstartApplicationSection {
  heading: string;
  label: string;
  help: string;
  workingCharacterLimit: number;
}

export interface OppstartApplicationSectionAnalysis extends OppstartApplicationSection {
  start: number;
  bodyStart: number;
  end: number;
  body: string;
  characters: number;
  words: number;
  remaining: number;
  openFieldPositions: number[];
  present: boolean;
  ready: boolean;
}

export interface OppstartOpenField {
  position: number;
  sectionHeading: string;
  sectionLabel: string;
}

/**
 * Interne arbeidsmål, ikke offisielle portalgrenser. Portalen kan endres,
 * derfor viser UI-et alltid disse som arbeidsmål og ber brukeren kontrollere
 * gjeldende felt på Min side før innsending.
 */
export const OPPSTART_APPLICATION_SECTIONS: readonly OppstartApplicationSection[] =
  [
    {
      heading: "## 1. Ideen — problem og kundeinnsikt",
      label: "Ideen og kundeinnsikt",
      help: "Reelle kunder, konkrete situasjoner, konsekvens og læring.",
      workingCharacterLimit: 3_000,
    },
    {
      heading: "## 2. Dagens alternativer og konkurrenter",
      label: "Alternativer og konkurrenter",
      help: "Hva kunden gjør i dag, svakheter, kostnad og tydelig gap.",
      workingCharacterLimit: 2_500,
    },
    {
      heading: "## 3. Nyhetsverdi — løsning og krevende teknologiutvikling",
      label: "Nyhetsverdi og teknologi",
      help: "Konkret løsning, kundeverdi, teknisk kompleksitet og usikkerhet.",
      workingCharacterLimit: 3_500,
    },
    {
      heading: "## 4. Langsiktige mål — marked og vekst",
      label: "Marked og vekst",
      help: "Startsegment, beregnet marked, kundetilgang og internasjonalt potensial.",
      workingCharacterLimit: 3_000,
    },
    {
      heading: "## 5. Fremdrift og aktiviteter — markedsavklaringsprosjektet",
      label: "Prosjekt og markedstest",
      help: "Usikkerhet → aktivitet → kundebidrag → signal → beslutning.",
      workingCharacterLimit: 4_000,
    },
    {
      heading: "## 6. Kostnader, leverandører og finansiering",
      label: "Kostnader og leverandører",
      help: "Kun eksterne, fremtidige kostnader med leverandør og testkobling.",
      workingCharacterLimit: 3_000,
    },
    {
      heading: "## 7. Team og gjennomføringsevne",
      label: "Team",
      help: "Relevant kompetanse, kapasitet, roller og kompetansegap.",
      workingCharacterLimit: 2_500,
    },
    {
      heading: "## 8. IPR, risiko, bærekraft og ansvarlig næringsliv",
      label: "IPR, risiko og bærekraft",
      help: "Rettigheter, risiko, ansvarlig næringsliv og annen offentlig støtte.",
      workingCharacterLimit: 3_000,
    },
    {
      heading: "## 9. Vedlegg og sluttkontroll",
      label: "Vedlegg og sluttkontroll",
      help: "Arkitektur, kundegrunnlag, marked, kostnadsunderlag og konsistens.",
      workingCharacterLimit: 2_000,
    },
  ] as const;

function countWords(value: string): number {
  const normalized = value
    .replace(/^#{1,6}\s+/gmu, "")
    .replaceAll(OPEN_FIELD_MARKER, "")
    .trim();
  return normalized ? normalized.split(/\s+/u).length : 0;
}

export function analyzeOppstartApplication(
  content: string,
): OppstartApplicationSectionAnalysis[] {
  return OPPSTART_APPLICATION_SECTIONS.map((section) => {
    const start = content.indexOf(section.heading);
    if (start < 0) {
      return {
        ...section,
        start: -1,
        bodyStart: -1,
        end: -1,
        body: "",
        characters: 0,
        words: 0,
        remaining: 0,
        openFieldPositions: [],
        present: false,
        ready: false,
      };
    }

    const bodyStart = start + section.heading.length;
    const rest = content.slice(bodyStart);
    const nextHeadingOffset = rest.search(/\n## \d+\./u);
    const end =
      nextHeadingOffset < 0 ? content.length : bodyStart + nextHeadingOffset;
    const body = content.slice(bodyStart, end).trim();
    const openFieldPositions: number[] = [];
    let searchFrom = bodyStart;
    while (searchFrom < end) {
      const position = content.indexOf(OPEN_FIELD_MARKER, searchFrom);
      if (position < 0 || position >= end) break;
      openFieldPositions.push(position);
      searchFrom = position + OPEN_FIELD_MARKER.length;
    }

    return {
      ...section,
      start,
      bodyStart,
      end,
      body,
      characters: body.length,
      words: countWords(body),
      remaining: openFieldPositions.length,
      openFieldPositions,
      present: true,
      ready: openFieldPositions.length === 0,
    };
  });
}

export function getOppstartSectionRange(
  content: string,
  heading: string | null,
): OppstartApplicationSectionAnalysis | null {
  if (!heading) return null;
  return (
    analyzeOppstartApplication(content).find(
      (section) => section.heading === heading && section.present,
    ) ?? null
  );
}

export function findOppstartSectionAtPosition(
  sections: readonly OppstartApplicationSectionAnalysis[],
  position: number,
): OppstartApplicationSectionAnalysis | null {
  return (
    sections.find(
      (section) =>
        section.present && position >= section.start && position <= section.end,
    ) ?? null
  );
}

export function listOppstartOpenFields(
  sections: readonly OppstartApplicationSectionAnalysis[],
): OppstartOpenField[] {
  return sections.flatMap((section) =>
    section.openFieldPositions.map((position) => ({
      position,
      sectionHeading: section.heading,
      sectionLabel: section.label,
    })),
  );
}

export function replaceOppstartSection(
  content: string,
  section: Pick<OppstartApplicationSectionAnalysis, "bodyStart" | "end">,
  nextBody: string,
): string {
  const existingBody = content.slice(section.bodyStart, section.end);
  const leadingBreak = existingBody.startsWith("\n") ? "\n" : "";
  const trailingBreak = existingBody.endsWith("\n") ? "\n" : "";
  return (
    content.slice(0, section.bodyStart) +
    leadingBreak +
    nextBody.trim() +
    trailingBreak +
    content.slice(section.end)
  );
}
