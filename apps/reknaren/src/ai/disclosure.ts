/**
 * KI-transparens. Bygger på EUs KI-forordning og Digitaliserings-/regjeringens
 * veileder «KI-assistenter i arbeidslivet»: brukeren skal alltid vite når hun ser
 * resultater fra kunstig intelligens, hva den brukes til, at et menneske har
 * kontrollen, og at ingenting bokføres uten godkjenning.
 *
 * Dette er en ærlig beskrivelse av hvor Reknaren FAKTISK bruker KI — ikke en
 * juridisk samsvarserklæring. KI foreslår og leser; den bokfører aldri.
 */
export interface AiUse {
  id: string;
  feature: string;
  purpose: string;
  provider: string;
  model: string;
  active: boolean;
  /** Hvordan mennesket beholder kontrollen for nettopp denne bruken. */
  humanControl: string;
  /** Hva som sendes til modellen og hvordan data håndteres. */
  dataNote: string;
}

export interface AiPrinciple {
  key: 'transparens' | 'dokumentasjon' | 'menneskelig-kontroll' | 'tydelig-ki';
  title: string;
  text: string;
}

export interface AiDisclosure {
  usesAi: boolean;
  headline: string;
  principles: AiPrinciple[];
  uses: AiUse[];
  humanOversight: string;
  limitations: string[];
}

const PRINCIPLES: AiPrinciple[] = [
  {
    key: 'transparens',
    title: 'Transparens',
    text: 'Vi forteller tydelig når du ser resultater fra kunstig intelligens, hvilken modell som er brukt, og hva vurderingen bygger på. Regler og satser hentes alltid fra et versjonert regelregister med kilder — aldri fra modellens frie tekst.',
  },
  {
    key: 'dokumentasjon',
    title: 'Dokumentasjon',
    text: 'Hvert bilag er merket med hvordan det ble lest (KI, OCR eller ren tekst), og hver bokføring har en uforanderlig revisjonslogg med hvem som godkjente og hva som eventuelt ble endret.',
  },
  {
    key: 'menneskelig-kontroll',
    title: 'Menneskelig kontroll',
    text: 'Kunstig intelligens leser og foreslår — den bokfører aldri selv. Ingenting føres i regnskapet uten at du godkjenner det, og du kan alltid overstyre konto, MVA-kode og beløp før bokføring.',
  },
  {
    key: 'tydelig-ki',
    title: 'Tydelig informasjon om KI',
    text: 'Alt som er lest eller foreslått av KI er merket i grensesnittet, aldri presentert som en endelig fasit. Usikkerhet vises som et tall, og avvik sendes til en kontrollkø i stedet for å bokføres.',
  },
];

export interface AiDisclosureInput {
  aiExtraction: boolean;
  aiModel: string;
  /** Om e-postskanning er aktiv (ekte Gmail via IMAP). */
  emailScanningActive: boolean;
  /** Modell for e-postklassifisering (Claude Haiku). */
  emailModel?: string;
}

export function buildAiDisclosure(input: AiDisclosureInput): AiDisclosure {
  const uses: AiUse[] = [
    {
      id: 'bilagslesing',
      feature: 'Bilagslesing',
      purpose:
        'Leser foto og PDF av kvitteringer og fakturaer og trekker ut strukturerte felt (leverandør, dato, beløp, MVA).',
      provider: 'Anthropic Claude',
      model: input.aiModel,
      active: input.aiExtraction,
      humanControl:
        'Summene valideres matematisk, og du godkjenner hvert bilag før bokføring. Avvik går til kontrollkø. Uten KI brukes OCR eller ren tekstlesing.',
      dataNote:
        'Bilaget sendes til modellen kun for tolkning. Den rå teksten persisteres aldri, og innholdet kontrolleres for manipulasjonsforsøk (prompt-injeksjon) før bruk.',
    },
    {
      id: 'epostfiltrering',
      feature: 'E-postfiltrering',
      purpose:
        'Vurderer om et e-postvedlegg faktisk er et bilag (faktura/kvittering) før det importeres, så innboksen ikke fylles med støy.',
      provider: 'Anthropic Claude',
      model: input.emailModel ?? 'claude-haiku-4-5',
      active: input.aiExtraction && input.emailScanningActive,
      humanControl:
        'Du velger selv hva som importeres. Tydelige tilfeller avgjøres av deterministiske heuristikker uten KI; KI brukes bare på det usikre.',
      dataNote: 'Kun emne, avsender og vedleggstype vurderes for klassifisering.',
    },
  ];

  return {
    usesAi: input.aiExtraction,
    headline: input.aiExtraction
      ? 'Reknaren bruker kunstig intelligens til å lese bilag og filtrere e-post. KI foreslår og leser — den bokfører aldri.'
      : 'Kunstig intelligens er ikke aktiv i dette miljøet. Bilag leses med OCR eller ren tekst, og alle forslag er regelbaserte.',
    principles: PRINCIPLES,
    uses,
    humanOversight:
      'Alle forslag krever menneskelig godkjenning før bokføring (requiresHumanReview). Bokføringsmotoren beregner deterministisk fra godkjente felt; den kopierer aldri tall direkte fra modellens tekst.',
    limitations: [
      'KI kan lese et beløp eller en dato feil — kontroller alltid før du godkjenner.',
      'Forslag til konto og MVA-kode er veiledende. Ved tvil, rådfør deg med en regnskapsfører.',
      'KI-lesing sender bilaginnhold til en ekstern modelltjeneste (Anthropic) for tolkning.',
    ],
  };
}
