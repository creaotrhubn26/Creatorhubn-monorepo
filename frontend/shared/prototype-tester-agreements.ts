/**
 * Canonical legal bundle for CreatorHub prototype testers.
 *
 * The server returns these exact documents to the acceptance page and stores
 * an immutable snapshot + SHA-256 digest when the tester accepts. Keep the
 * version constants in sync with every material text change.
 *
 * These are operational contract drafts and must be reviewed by qualified
 * Norwegian counsel before broad commercial use.
 */

export const CREATORHUB_LEGAL_ENTITY = {
  name: "Creatorhub AS",
  organizationNumber: "937 518 684",
  country: "Norge",
  email: "daniel@creatorhubn.com",
} as const;

export const PROGRAM_TERMS_VERSION = "1.0";
export const NDA_VERSION = "1.1";
export const DPA_VERSION = "1.0";
export const LETTER_OF_INTENT_VERSION = "1.0";

export const TESTER_PROGRAM_TERMS = {
  durationWeeks: 12,
  expectedHoursPerWeek: 2,
  feedbackMinimumPerMonth: 4,
  criticalBugResponseHours: 24,
  benefits: [
    "12 måneder gratis CreatorHub Professional-plan etter fullført testperiode",
    "«Early supporter»-badge på profilen din",
    "Direkte tilgang til produktteamet via prioritert kanal",
    "Tidlig tilgang til nye funksjoner under utvikling",
  ],
  obligations: [
    "Test minst én ny funksjon eller flyt per uke",
    "Logg minst fire feedback-elementer per måned via tilbakemeldingsfunksjonen",
    "Svar på korte spørreundersøkelser innen sju dager",
    "Rapporter kritiske feil innen 24 timer",
    "Respekter konfidensialitetsavtalen og ikke del ikke-offentlig produktinformasjon",
  ],
  feedbackChannels: {
    primary: {
      label: "Tilbakemeldingsfunksjonen i CreatorHub",
      description:
        "Foretrukket kanal for observasjoner, feil og forbedringsforslag.",
      icon: "feedback",
    },
    monthlySurvey: {
      label: "Månedlig spørreundersøkelse",
      description:
        "En kort, strukturert undersøkelse sendes normalt hver måned.",
      icon: "poll",
    },
    emergency: {
      label: "Direkte e-post for kritiske feil",
      description: "daniel@creatorhubn.com — bare for blokkerende feil.",
      icon: "email",
    },
  },
  exitClause:
    "Du kan trekke deg fra programmet når som helst med sju dagers varsel. Vi kan be om en kort, frivillig exit-undersøkelse.",
  whatYouGetAccess: [
    "CreatorHub-plattformen, inkludert utvalgte ikke-frigjorte funksjoner",
    "Privat kontaktflate med produktteamet",
    "Månedlig onboarding eller innsjekk ved behov",
  ],
  whatYouDoNotGet: [
    "Tilgang til The Role Room sitt separate testerprogram",
    "Kompensasjon i penger; eventuell belønning følger programvilkårene",
    "Garantert responstid eller tjenestenivå fra produktteamet",
  ],
} as const;

export type PrototypeTesterAgreementKey =
  | "program_terms"
  | "nda"
  | "dpa"
  | "letter_of_intent";

export type PrototypeTesterAgreementVersions = Record<
  PrototypeTesterAgreementKey,
  string
>;

export type PrototypeTesterAgreementDocument = {
  key: PrototypeTesterAgreementKey;
  title: string;
  shortTitle: string;
  version: string;
  content: string;
  acceptanceLabel: string;
  bindingNature: "binding" | "non_binding";
};

export type PrototypeTesterAgreementContext = {
  testerName: string;
  testerEmail: string;
  testerCompany?: string | null;
};

export function canonicalJsonStringify(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      return Object.keys(input as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = normalize((input as Record<string, unknown>)[key]);
          return result;
        }, {});
    }
    return input;
  };

  return JSON.stringify(normalize(value));
}

export const CURRENT_PROTOTYPE_TESTER_AGREEMENT_VERSIONS: PrototypeTesterAgreementVersions =
  {
    program_terms: PROGRAM_TERMS_VERSION,
    nda: NDA_VERSION,
    dpa: DPA_VERSION,
    letter_of_intent: LETTER_OF_INTENT_VERSION,
  };

export function programTermsAsText(): string {
  const terms = TESTER_PROGRAM_TERMS;
  return [
    `PROTOTYPE-TESTERPROGRAM — VILKÅR (v${PROGRAM_TERMS_VERSION})`,
    "",
    `Varighet: ${terms.durationWeeks} uker`,
    `Forventet innsats: omtrent ${terms.expectedHoursPerWeek} timer per uke og minst ${terms.feedbackMinimumPerMonth} tilbakemeldinger per måned.`,
    "",
    "TESTERENS FORPLIKTELSER",
    ...terms.obligations.map((item) => `• ${item}`),
    "",
    "YTELSER VED FULLFØRING",
    ...terms.benefits.map((item) => `• ${item}`),
    "",
    "TILGANG",
    ...terms.whatYouGetAccess.map((item) => `• ${item}`),
    "",
    "AVGRENSNINGER",
    ...terms.whatYouDoNotGet.map((item) => `• ${item}`),
    "",
    "UTMELDING",
    terms.exitClause,
    "",
    "CreatorHub kan avslutte eller begrense testtilgangen ved sikkerhetsbrudd, misbruk eller vesentlig mislighold. Gratisperioden etter programmet forutsetter at de beskrevne minimumsforpliktelsene i hovedsak er oppfylt. Avgjørelser skal være saklige og kan tas opp med CreatorHub.",
  ].join("\n");
}

export function programTermsShortSummary(): string {
  const terms = TESTER_PROGRAM_TERMS;
  return `${terms.durationWeeks} uker, omtrent ${terms.expectedHoursPerWeek} t/uke og minst ${terms.feedbackMinimumPerMonth} tilbakemeldinger per måned. Belønning ved fullføring: 12 måneder CreatorHub Professional uten abonnementsvederlag.`;
}

function counterparty(context: PrototypeTesterAgreementContext): string {
  const company = String(context.testerCompany || "").trim();
  return company
    ? `${company}, representert ved ${context.testerName} (${context.testerEmail})`
    : `${context.testerName} (${context.testerEmail})`;
}

function buildLegacyNda(
  context: PrototypeTesterAgreementContext,
  version: string,
): string {
  return `NON-DISCLOSURE AGREEMENT (NDA) — Prototype Tester Program (v${version})

Mellom:
  Creatorhub AS ("CreatorHub")
og
  ${counterparty(context)} ("Tester")

1. KONFIDENSIELL INFORMASJON
Tester får tilgang til CreatorHubs ikke-frigjorte funksjoner, interne veikart, designiterasjoner og feilrapportdetaljer. Informasjonen skal behandles konfidensielt.

2. FORPLIKTELSER
Tester skal ikke dele skjermbilder, video eller funksjonsbeskrivelser offentlig, vise plattformen til uvedkommende eller utnytte ikke-offentlig informasjon kommersielt før den er frigitt.

3. VARIGHET
Konfidensialiteten gjelder under testperioden og i 12 måneder etter at programmet er avsluttet.

4. UNNTAK
Avtalen gjelder ikke informasjon som blir offentlig kjent uten Testers medvirkning, som Tester lovlig kjente fra før, ble lovlig mottatt fra tredjepart uten taushetsplikt, eller må utleveres etter lovlig myndighetspålegg.

5. BRUDD
Brudd kan medføre stengt tilgang, bortfall av programfordeler og ansvar for dokumentert tap etter alminnelige norske erstatningsregler.

6. ELEKTRONISK AKSEPT
Navn, tidspunkt, IP-adresse, nettleseropplysninger, dokumentversjon og dokumentets kontrollsum lagres som bevis på aksept.`;
}

function buildNda(
  context: PrototypeTesterAgreementContext,
  version: string,
): string {
  if (version === "1.0") return buildLegacyNda(context, version);
  return `KONFIDENSIALITETSAVTALE (NDA) — CREATORHUB PROTOTYPE-TESTERPROGRAM (v${version})

PARTER
Creatorhub AS, org.nr. ${CREATORHUB_LEGAL_ENTITY.organizationNumber}, Norge ("CreatorHub") og ${counterparty(context)} ("Tester").

1. FORMÅL OG KONFIDENSIELL INFORMASJON
Tester får begrenset tilgang for å evaluere CreatorHub. Konfidensiell informasjon omfatter ikke-offentlige funksjoner, kilde- og systeminformasjon, veikart, design, priser, sikkerhetsforhold, feilrapporter, forretningsplaner og annet materiale som etter sin art eller merking bør forstås som fortrolig.

2. TESTERENS PLIKTER
Tester skal bare bruke informasjonen til avtalt testing, beskytte den minst like godt som egen fortrolig informasjon, begrense tilgangen til personer som er uttrykkelig godkjent, og straks varsle ${CREATORHUB_LEGAL_ENTITY.email} ved mistenkt tap eller uautorisert tilgang. Skjermbilder, opptak, demonstrasjoner og funksjonsdetaljer skal ikke publiseres eller deles uten skriftlig samtykke.

3. UNNTAK
Pliktene gjelder ikke informasjon Tester kan dokumentere var offentlig kjent uten avtalebrudd, var lovlig kjent før mottak, ble lovlig mottatt fra tredjepart uten taushetsplikt, eller ble utviklet uavhengig. Lovpålagt utlevering er tillatt; CreatorHub skal varsles på forhånd når loven tillater det.

4. RETTIGHETER OG TILBAKELEVERING
Ingen immaterielle rettigheter overføres. Ved avslutning skal konfidensielt materiale slettes eller returneres etter CreatorHubs instruks, med unntak for lovpålagt arkivering og ordinære, utilgjengelige sikkerhetskopier.

5. VARIGHET OG MISLIGHOLD
Avtalen gjelder fra elektronisk aksept. Taushetsplikten varer gjennom testperioden og i 24 måneder etterpå; for forretningshemmeligheter så lenge informasjonen rettslig er en forretningshemmelighet. Vesentlig brudd kan medføre umiddelbart stengt tilgang og ansvar for dokumentert tap etter norsk rett.

6. LOVVALG
Avtalen reguleres av norsk rett. Tvister søkes løst i minnelighet før de eventuelt bringes inn for ordinære norske domstoler.

7. ELEKTRONISK AKSEPT
Signerens navn, e-post, tidspunkt, IP-adresse, brukeragent, versjon, full dokumenttekst og SHA-256-kontrollsum lagres som dokumentasjon. Løsningen er en enkel elektronisk signatur, ikke en kvalifisert elektronisk signatur.`;
}

function buildDpa(
  context: PrototypeTesterAgreementContext,
  version: string,
): string {
  return `DATABEHANDLERAVTALE — CREATORHUB (v${version})

PARTER OG ROLLER
Behandlingsansvarlig: ${counterparty(context)} ("Kunden").
Databehandler: Creatorhub AS, org.nr. ${CREATORHUB_LEGAL_ENTITY.organizationNumber}, Norge ("CreatorHub").

Denne avtalen gjelder bare i den utstrekning Kunden legger personopplysninger om andre inn i CreatorHub og CreatorHub behandler dem på Kundens vegne. For opplysninger CreatorHub behandler til egne formål, er CreatorHub selv behandlingsansvarlig etter personvernerklæringen.

1. BEHANDLINGEN
Formål og art: lagring, organisering, visning, deling, sikkerhetskopiering, teknisk drift og annen behandling som er nødvendig for å levere funksjoner Kunden uttrykkelig bruker i CreatorHub.
Varighet: så lenge testkontoen eller en etterfølgende tjenesteavtale er aktiv, pluss nødvendig tid til sikker sletting, sikkerhetskopirotasjon og lovpålagt oppbevaring.
Registrerte: Kundens ansatte, oppdragstakere, samarbeidspartnere, klienter, kunder, talenter, deltakere og kontaktpersoner.
Opplysningstyper: navn og kontaktdata, konto- og tilgangsdata, prosjektmetadata, meldinger, avtaler, bilder/filer, kalender- og leveransedata samt faktura- og kundedata som Kunden velger å registrere. Særlige kategorier og fødselsnummer skal ikke legges inn uten særskilt dokumentert grunnlag og skriftlig avtale.

2. INSTRUKSER OG FORMÅLSBEGRENSNING
CreatorHub behandler bare opplysningene etter dokumenterte instrukser fra Kunden, herunder innstillinger og handlinger i tjenesten, med mindre behandling kreves ved lov. CreatorHub varsler før lovpålagt behandling når loven tillater det, og sier fra dersom en instruks etter vår vurdering strider mot personvernregelverket.

3. KONFIDENSIALITET OG SIKKERHET
Personer med tilgang er bundet av taushetsplikt. CreatorHub bruker risikobaserte tekniske og organisatoriske tiltak, herunder tilgangsstyring, kryptert transport, logging, sikkerhetskopiering, sårbarhets- og hendelseshåndtering samt rutiner for gjenoppretting og tilgangsrevisjon.

4. UNDERDATABEHANDLERE OG OVERFØRINGER
Kunden gir generell skriftlig godkjenning til nødvendige underdatabehandlere for hosting, database, lagring, e-post, betaling, overvåking, integrasjoner og valgfri AI-behandling. Gjeldende kategorier og sentrale leverandører fremgår av CreatorHubs personvernerklæring eller oppgis på forespørsel. Vesentlige endringer varsles gjennom tjenesten eller e-post slik at Kunden kan fremme en saklig personverninnsigelse. CreatorHub pålegger underdatabehandlere tilsvarende plikter. Overføring utenfor EU/EØS krever gyldig overføringsgrunnlag og nødvendige tilleggstiltak.

5. BISTAND
Med hensyn til behandlingens art bistår CreatorHub Kunden med forespørsler fra registrerte, informasjonssikkerhet, bruddvarsling, vurdering av personvernkonsekvenser og forhåndsdrøftelser. CreatorHub varsler Kunden uten ugrunnet opphold etter å ha blitt kjent med et brudd som berører Kundens data.

6. SLETTING, RETUR OG REVISJON
Ved opphør sletter eller returnerer CreatorHub personopplysningene etter Kundens valg, med mindre lov krever videre lagring. CreatorHub gjør nødvendig informasjon tilgjengelig for å dokumentere etterlevelse og tillater forholdsmessige revisjoner. Revisjoner avtales på forhånd, ivaretar andre kunders sikkerhet og konfidensialitet, og Kunden dekker urimelige merkostnader med mindre revisjonen avdekker et vesentlig avvik.

7. KUNDENS ANSVAR
Kunden skal ha gyldig behandlingsgrunnlag, gi nødvendig informasjon til registrerte, konfigurere tilganger forsvarlig og bare legge inn opplysninger som er nødvendige. Testkontoen skal fortrinnsvis bruke syntetiske eller anonymiserte data.

8. RANG OG LOVVALG
Denne avtalen oppfyller partenes krav til databehandleravtale etter personvernforordningen artikkel 28. Ved konflikt om personvern går denne avtalen foran generelle tjenestevilkår. Norsk rett gjelder, uten at registrertes ufravikelige rettigheter begrenses.

VEDLEGG A — DOKUMENTERT HOVEDINSTRUKS
CreatorHub kan utføre de operasjonene Kunden initierer eller konfigurerer i tjenesten, utelukkende for å levere, sikre, feilsøke og forbedre den avtalte tjenesten. Personopplysninger skal ikke brukes til markedsføring eller generell modelltrening uten et eget gyldig behandlingsgrunnlag og tydelig informasjon.`;
}

function buildLetterOfIntent(
  context: PrototypeTesterAgreementContext,
  version: string,
): string {
  return `INTENSJONSAVTALE — CREATORHUB PROTOTYPE-TESTERPROGRAM (v${version})

PARTER
Creatorhub AS, org.nr. ${CREATORHUB_LEGAL_ENTITY.organizationNumber}, Norge ("CreatorHub") og ${counterparty(context)} ("Tester").

1. FELLES INTENSJON
Partene ønsker å samarbeide i en avgrenset prototypeperiode for å undersøke om CreatorHub kan forbedre arbeidsflyten til kreative virksomheter, og om Testers praktiske erfaring kan bidra til et bedre produkt.

2. PLANLAGT SAMARBEID
Partene har til hensikt å gjennomføre et 12-ukers testerprogram. Tester vil tilstrebe regelmessig bruk og konkrete tilbakemeldinger. CreatorHub vil tilstrebe tilgang til relevante prototyper, en tydelig kanal for feedback og rimelig oppfølging. Detaljerte minimumsforpliktelser og eventuelle fordeler følger de separat aksepterte programvilkårene.

3. VIDERE MULIGHETER
Partene kan senere diskutere ordinært kundeforhold, referansebruk, faglig samarbeid eller andre kommersielle muligheter. Ingen av partene er forpliktet til å inngå en slik senere avtale.

4. INGEN ANSETTELSE, EKSKLUSIVITET ELLER FULLMAKT
Avtalen etablerer ikke ansettelse, oppdragstakerforhold, partnerskap, agentur, eksklusivitet eller fullmakt til å binde den andre parten. Hver part dekker egne kostnader med mindre annet avtales skriftlig.

5. IKKE-BINDENDE KARAKTER
Denne intensjonsavtalen uttrykker mål og forventninger og er ikke i seg selv rettslig bindende. Den endrer ikke de separat aksepterte og bindende programvilkårene, konfidensialitetsavtalen eller databehandleravtalen.

6. VARIGHET OG DIALOG
Intensjonsavtalen gjelder gjennom testerperioden og kan avsluttes av hver part med sju dagers varsel. Uenighet søkes løst gjennom dialog. Norsk rett er referanseramme for tolkningen.

7. ELEKTRONISK BEKREFTELSE
Ved elektronisk bekreftelse viser partene at teksten er lest og at den beskriver deres nåværende intensjon. Bekreftelsen gjør ikke punkt 1–6 bindende utover det som uttrykkelig følger av separate avtaler eller ufravikelig lov.`;
}

export function buildPrototypeTesterAgreementBundle(
  context: PrototypeTesterAgreementContext,
  versions: Partial<PrototypeTesterAgreementVersions> = {},
): PrototypeTesterAgreementDocument[] {
  const resolved = {
    ...CURRENT_PROTOTYPE_TESTER_AGREEMENT_VERSIONS,
    ...versions,
  };
  return [
    {
      key: "program_terms",
      title: "Vilkår for prototype-testerprogrammet",
      shortTitle: "Programvilkår",
      version: resolved.program_terms,
      content: programTermsAsText(),
      acceptanceLabel: "Jeg har lest og godtar programvilkårene.",
      bindingNature: "binding",
    },
    {
      key: "nda",
      title: "Konfidensialitetsavtale (NDA)",
      shortTitle: "NDA",
      version: resolved.nda,
      content: buildNda(context, resolved.nda),
      acceptanceLabel: "Jeg har lest og godtar konfidensialitetsavtalen.",
      bindingNature: "binding",
    },
    {
      key: "dpa",
      title: "Databehandleravtale",
      shortTitle: "Databehandleravtale",
      version: resolved.dpa,
      content: buildDpa(context, resolved.dpa),
      acceptanceLabel:
        "Jeg har lest og godtar databehandleravtalen på vegne av meg selv eller virksomheten jeg representerer.",
      bindingNature: "binding",
    },
    {
      key: "letter_of_intent",
      title: "Intensjonsavtale",
      shortTitle: "Intensjonsavtale",
      version: resolved.letter_of_intent,
      content: buildLetterOfIntent(context, resolved.letter_of_intent),
      acceptanceLabel:
        "Jeg har lest og bekrefter den ikke-bindende intensjonsavtalen.",
      bindingNature: "non_binding",
    },
  ];
}
