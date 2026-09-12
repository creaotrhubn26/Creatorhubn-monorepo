/**
 * Canonical legal bundle for CreatorHub prototype testers.
 *
 * The server returns these exact documents to the acceptance page and stores
 * an immutable snapshot + SHA-256 digest when the tester accepts. Keep the
 * version constants in sync with every material text change.
 *
 * The DPA structure follows GDPR article 28 and Datatilsynet's published
 * processor-agreement checklist. The electronic-acceptance wording follows
 * eIDAS article 25 as implemented by Norway's electronic trust services act.
 * Product owners must still keep the factual descriptions of processing,
 * security measures and subprocessors accurate as the service changes.
 */

export const CREATORHUB_LEGAL_ENTITY = {
  name: "Creatorhub AS",
  organizationNumber: "937 518 684",
  address: "Søsterveien 11, 1474 Lørenskog",
  country: "Norge",
  email: "daniel@creatorhubn.com",
} as const;

export const PROGRAM_TERMS_VERSION = "1.0";
export const NDA_VERSION = "1.1";
export const DPA_VERSION = "1.1";
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
  testerOrganizationNumber?: string | null;
  testerBusinessAddress?: string | null;
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
  const organizationNumber = String(
    context.testerOrganizationNumber || "",
  ).replace(/\D/g, "");
  const formattedOrganizationNumber = /^\d{9}$/.test(organizationNumber)
    ? organizationNumber.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")
    : "";
  const businessAddress = String(context.testerBusinessAddress || "").trim();
  const legalIdentity = [
    company,
    formattedOrganizationNumber ? `org.nr. ${formattedOrganizationNumber}` : "",
    businessAddress,
  ].filter(Boolean).join(", ");
  return company
    ? `${legalIdentity}, representert ved ${context.testerName} (${context.testerEmail})`
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

function buildLegacyDpa(
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

function buildDpa(
  context: PrototypeTesterAgreementContext,
  version: string,
): string {
  if (version === "1.0") return buildLegacyDpa(context, version);

  return `DATABEHANDLERAVTALE — CREATORHUB (v${version})

PARTER, KONTAKT OG ROLLER
Behandlingsansvarlig: ${counterparty(context)} ("Kunden").
Databehandler: Creatorhub AS, org.nr. ${CREATORHUB_LEGAL_ENTITY.organizationNumber}, ${CREATORHUB_LEGAL_ENTITY.address}, ${CREATORHUB_LEGAL_ENTITY.country} ("CreatorHub"). Personvernkontakt: ${CREATORHUB_LEGAL_ENTITY.email}.

Avtalen er bindende mellom partene og gjelder bare når Kunden legger personopplysninger om andre inn i CreatorHub og CreatorHub behandler dem på Kundens vegne. For opplysninger CreatorHub bestemmer formål og midler for selv, er CreatorHub behandlingsansvarlig etter personvernerklæringen.

1. GJENSTAND, OMFANG OG VARIGHET
CreatorHub stiller en nettbasert produksjons- og samarbeidsplattform til rådighet og utfører lagring, organisering, visning, deling, sikkerhetskopiering, sikring, feilsøking, eksport og sletting som Kunden initierer eller som er nødvendig for å levere de aktiverte funksjonene.

Behandlingen varer så lenge testkontoen eller en etterfølgende tjenesteavtale er aktiv, og deretter bare så lenge det er nødvendig for kontrollert eksport, sletting, sikkerhetskopirotasjon eller oppfyllelse av lovkrav. Kategorier av registrerte, opplysningstyper og hovedinstruks fremgår av vedlegg A.

2. KUNDENS RETTIGHETER, PLIKTER OG INSTRUKSER
Kunden bestemmer formål og vesentlige hjelpemidler for behandlingen og er ansvarlig for behandlingsgrunnlag, åpenhet overfor registrerte, dataminimering, riktige tilganger og lovligheten av instruksene. Kunden har rett og plikt til å gi dokumenterte instrukser gjennom denne avtalen, tjenestens innstillinger og skriftlige henvendelser fra en autorisert representant.

CreatorHub behandler personopplysninger bare etter slike dokumenterte instrukser, også ved overføring til et tredjeland eller en internasjonal organisasjon, med mindre norsk eller annen bindende EØS-rett krever behandlingen. CreatorHub varsler Kunden før lovpålagt behandling når loven tillater det, og varsler omgående dersom en instruks etter CreatorHubs vurdering strider mot personvernregelverket. Kunden kan avslutte den berørte tjenesten dersom CreatorHub ikke lenger gir tilstrekkelige garantier eller vesentlig misligholder avtalen.

3. FORTROLIGHET OG TILGANG
CreatorHub sikrer at personer som gis tilgang er autorisert ut fra tjenstlig behov og bundet av avtalefestet eller lovfestet taushetsplikt. Tilgang skal fjernes når behovet eller autorisasjonen opphører. CreatorHub skal på forespørsel kunne dokumentere slike forpliktelser uten å røpe andre personers beskyttede opplysninger. Fortrolighetsplikten består etter at oppdraget eller personens arbeid avsluttes.

4. INFORMASJONSSIKKERHET
CreatorHub gjennomfører egnede tekniske og organisatoriske tiltak etter personvernforordningen artikkel 32, tilpasset risiko, teknisk nivå, kostnader, behandlingens art og omfang og mulige konsekvenser for de registrerte. Avtalte minimumstiltak fremgår av vedlegg B. Tiltakene skal vurderes jevnlig og vesentlige svekkelser skal ikke gjennomføres uten saklig grunn og nødvendig risikohåndtering.

5. UNDERDATABEHANDLERE OG INTERNASJONALE OVERFØRINGER
Kunden gir CreatorHub generell skriftlig godkjenning til å bruke underdatabehandlerne i vedlegg C for de angitte formålene. CreatorHub skal varsle Kunden skriftlig minst 14 kalenderdager før en planlagt ny eller erstattet underdatabehandler tas i bruk, med mindre en dokumentert sikkerhets- eller kontinuitetshendelse gjør kortere frist nødvendig. Kunden kan innen varslingsfristen fremme en saklig personverninnsigelse. Partene skal da søke et forsvarlig alternativ; hvis dette ikke er mulig, kan Kunden avslutte den berørte funksjonen eller avtalen.

CreatorHub skal ved skriftlig avtale pålegge hver underdatabehandler de samme relevante personvernforpliktelsene som følger av denne avtalen. CreatorHub har fullt ansvar overfor Kunden dersom en underdatabehandler ikke oppfyller sine forpliktelser. Overføring utenfor EU/EØS skal ha gyldig overføringsgrunnlag, dokumentert vurdering og nødvendige tilleggstiltak. Kunden kan be om den til enhver tid gjeldende listen og relevant dokumentasjon om overføringsgrunnlaget.

6. REGISTRERTES RETTIGHETER
CreatorHub bistår, så langt det er mulig ut fra behandlingens art, med egnede tekniske og organisatoriske tiltak slik at Kunden kan besvare krav om innsyn, retting, sletting, begrensning, dataportabilitet og innsigelse. Henvendelser CreatorHub mottar direkte om Kundens data videresendes uten ugrunnet opphold. CreatorHub besvarer dem ikke på Kundens vegne uten dokumentert instruks, med mindre lov krever det.

7. SIKKERHETSBRUDD OG ANNEN BISTAND
CreatorHub varsler Kunden uten ugrunnet opphold etter å ha blitt kjent med et brudd på personopplysningssikkerheten som berører Kundens data. Varslet skal, etter hvert som informasjonen blir tilgjengelig, beskrive hendelsens art, berørte kategorier og omtrentlig omfang, sannsynlige konsekvenser, iverksatte eller planlagte tiltak og kontaktpunkt. CreatorHub skal bevare relevant hendelsesdokumentasjon og bistå Kunden med pliktene etter artikkel 32–36, herunder risikovurdering, melding til tilsynsmyndighet, informasjon til registrerte, vurdering av personvernkonsekvenser og forhåndsdrøftelse.

8. SLETTING, RETUR OG BEKREFTELSE
Ved opphør velger Kunden om CreatorHub skal returnere eller slette personopplysningene, og CreatorHub skal deretter slette eksisterende kopier med mindre lov krever videre lagring. Data i ordinære, utilgjengelige sikkerhetskopier slettes gjennom den dokumenterte rotasjonssyklusen og skal i mellomtiden ikke brukes til andre formål. På forespørsel skal CreatorHub skriftlig bekrefte gjennomført sletting eller forklare lovgrunnlag og lagringstid for data som må beholdes.

9. DOKUMENTASJON, REVISJON OG TILSYN
CreatorHub gjør tilgjengelig den informasjonen som er nødvendig for å påvise oppfyllelse av artikkel 28 og bidrar til forholdsmessige revisjoner og inspeksjoner gjennomført av Kunden eller en uavhengig revisor med fullmakt. Partene skal normalt bruke oppdaterte sikkerhetsrapporter og fjernrevisjon før stedlig inspeksjon. Revisjon varsles rimelig, gjennomføres i arbeidstid og skal beskytte andre kunders data og CreatorHubs sikkerhet og forretningshemmeligheter. Kunden dekker urimelige merkostnader, med mindre revisjonen avdekker et vesentlig avvik hos CreatorHub.

10. ANSVAR, RANG OG LOVVALG
Partenes ansvar følger personvernforordningen og ellers norsk rett. Avtalen begrenser ikke registrertes ufravikelige rettigheter eller tilsynsmyndighetens kompetanse. Ved konflikt om behandling av personopplysninger går denne avtalen foran generelle program- eller tjenestevilkår. Tvister søkes løst i minnelighet før de eventuelt bringes inn for ordinære norske domstoler.

11. ELEKTRONISK AKSEPT OG DOKUMENTASJON
Partene er enige om at elektronisk aksept er ment å uttrykke bindende samtykke til denne avtalen. Signerens navn, inviterte e-postadresse, e-postbekreftelse, tidspunkt, fullmaktserklæring, dokumentversjon, full dokumenttekst og SHA-256-kontrollsum lagres som bevis. Tekniske sikkerhetsopplysninger kan lagres i en tilgangsbegrenset akseptlogg. Metoden er en enkel elektronisk signatur, ikke BankID eller en kvalifisert elektronisk signatur.

VEDLEGG A — BEHANDLING OG DOKUMENTERT HOVEDINSTRUKS
Formål: levere de CreatorHub-funksjonene Kunden uttrykkelig aktiverer, og sikre, vedlikeholde og feilsøke tjenesten.
Registrerte: Kundens ansatte, oppdragstakere, samarbeidspartnere, klienter, kunder, talenter, deltakere og kontaktpersoner.
Opplysningstyper: navn og kontaktdata, konto- og tilgangsdata, prosjektmetadata, meldinger, avtaler, bilder, lyd, video, dokumenter, kalender- og leveransedata samt faktura- og kundedata Kunden velger å registrere.
Særlige kategorier og fødselsnummer: skal ikke legges inn uten særskilt dokumentert behov, gyldig behandlingsgrunnlag, risikovurdering og skriftlig instruks som CreatorHub har akseptert.
Instruks: CreatorHub kan utføre operasjonene Kunden initierer eller konfigurerer og den behandlingen som er nødvendig for drift, sikkerhet, sikkerhetskopiering, gjenoppretting, support og sletting. Kundedata skal ikke brukes til markedsføring eller generell modelltrening uten separat rettslig grunnlag og tydelig informasjon.

VEDLEGG B — MINIMUMSTILTAK FOR SIKKERHET
• Tilgang etter minste privilegium, individuelle kontoer og sterk autentisering for privilegerte funksjoner.
• Kryptert transport over offentlige nett og leverandørstøttet kryptering av vedvarende skylagring.
• Loggføring og tilgangsbegrenset oppfølging av sikkerhetsrelevante hendelser og administrative handlinger.
• Sikkerhetskopiering, gjenopprettingsrutiner og tiltak for tilgjengelighet og motstandsdyktighet tilpasset tjenestens risiko.
• Rutiner for sårbarhetshåndtering, sikkerhetsoppdateringer, hendelseshåndtering og periodisk vurdering av tiltakenes effektivitet.
• Logisk separasjon, autorisasjonskontroller og sikker sletting eller tilbakelevering av kundedata.
• Dataminimering og bruk av syntetiske eller anonymiserte data i prototypeperioden når reelle personopplysninger ikke er nødvendige.

VEDLEGG C — GODKJENTE UNDERDATABEHANDLERE
• Render Services, Inc. — applikasjonsdrift og backend-hosting.
• Neon, LLC / Databricks, Inc. — administrert PostgreSQL-database.
• Cloudflare, Inc. — objektlagring, innholdslevering og sikkerhetstjenester.
• Plus Five Five, Inc. (Resend) — transaksjons- og system-e-post.
• Functional Software, Inc. (Sentry) — feil- og ytelsesovervåking når aktivert.
• Anthropic, PBC, OpenAI Ireland Ltd. og Cohere Inc. — valgfri AI-behandling bare når Kunden aktiverer en funksjon som bruker den aktuelle leverandøren.

Leverandørens avtalte behandlingsregion og overføringsmekanisme gjelder for den konkrete tjenesten. CreatorHub skal holde listen og de faktiske behandlingsforholdene oppdatert og varsle endringer etter punkt 5.`;
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
