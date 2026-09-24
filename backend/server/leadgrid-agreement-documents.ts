/**
 * Avtaletekstene kunden signerer.
 *
 * De ligger i kode, ikke i databasen, med vilje: signaturen lagrer en hash av
 * teksten, og da må teksten være versjonskontrollert og gjennomgåbar i en
 * pull request. Endrer noen et ord, endrer hashen seg, og den nye versjonen
 * må signeres på nytt — det er hele poenget.
 *
 * JURIDISK FORBEHOLD: databehandleravtalen dekker punktene GDPR artikkel
 * 28 nr. 3 krever, men den er ikke kvalitetssikret av advokat. Den skal
 * gjennomgås før den brukes mot en ekte kunde. Underleverandørlista må
 * dessuten stemme med hva dere faktisk bruker — står det feil der, er avtalen
 * misvisende på det punktet som oftest blir etterspurt.
 */
import type { AgreementType } from "./leadgrid-org-agreements.js";
import { PROVIDER } from "./leadgrid-org-agreements.js";

export interface AgreementDocument {
  type: AgreementType;
  title: string;
  version: string;
  /** Én setning om hva kunden faktisk sier ja til. Vises over teksten. */
  summary: string;
  /** Kreves før organisasjonen kan behandle data lovlig. */
  required: boolean;
  /** Krever bekreftelse av fakturaopplysninger i samme steg. */
  confirmsBilling: boolean;
  body: string;
}

const P = PROVIDER;

const DPA = `# Databehandleravtale

**Behandlingsansvarlig (kunden)** og **databehandler ${P.legalName}**,
org.nr ${P.orgNumber}, ${P.address}.

## 1. Hva avtalen gjelder
Databehandler leverer tjenesten Leadgrid og behandler personopplysninger på
vegne av behandlingsansvarlig. Avtalen gjelder så lenge tjenesten leveres.

## 2. Formål og art
Behandlingen skjer for å finne, vurdere og følge opp virksomheter som
behandlingsansvarlig vurderer som mulige kunder, og for å drifte tjenesten.

## 3. Hvilke opplysninger
Navn, stilling, telefonnummer, e-postadresse og arbeidssted for
kontaktpersoner hos virksomheter, samt notater og aktivitet
behandlingsansvarlig selv registrerer. Opplysninger om registrerte hentes fra
åpne kilder — Enhetsregisteret og virksomheters egne nettsider — og fra
opplysninger behandlingsansvarlig selv legger inn eller importerer.

## 4. Databehandlers plikter
Databehandler behandler personopplysninger bare etter dokumenterte
instrukser fra behandlingsansvarlig. Bruk av tjenesten slik den er beskrevet
regnes som slik instruks. Databehandler varsler uten ugrunnet opphold dersom
en instruks etter databehandlers syn er i strid med personvernregelverket.

Alle med tilgang til personopplysningene er underlagt taushetsplikt.

## 5. Sikkerhet
Databehandler gjennomfører egnede tekniske og organisatoriske tiltak etter
artikkel 32, herunder kryptering under overføring, tilgangsstyring per
organisasjon og prosjekt, logging av tilgang, og sikkerhetskopiering.

## 6. Underdatabehandlere
Behandlingsansvarlig gir generell godkjenning til bruk av
underdatabehandlere. Databehandler varsler om endringer i god tid, slik at
behandlingsansvarlig kan protestere. Gjeldende liste er tilgjengelig i
tjenesten og omfatter leverandører av skytjenester, databasedrift,
e-postutsending og betalingsformidling.

Underdatabehandlere pålegges samme plikter som følger av denne avtalen.

## 7. Overføring ut av EØS
Personopplysninger behandles innenfor EU/EØS. Skjer overføring utenfor EØS,
skjer den på gyldig overføringsgrunnlag.

## 8. Bistand
Databehandler bistår behandlingsansvarlig med å oppfylle plikter etter
artiklene 32 til 36, og med å besvare henvendelser fra registrerte om innsyn,
retting, sletting og innsigelse.

## 9. Avvik
Databehandler varsler behandlingsansvarlig uten ugrunnet opphold, og senest
innen 24 timer, ved brudd på personopplysningssikkerheten, med de
opplysninger behandlingsansvarlig trenger for å melde til Datatilsynet.

## 10. Revisjon
Behandlingsansvarlig kan kreve dokumentasjon på at avtalen overholdes, og kan
gjennomføre revisjon. Revisjon varsles i rimelig tid og gjennomføres slik at
den ikke er til urimelig ulempe for driften.

## 11. Sletting
Ved opphør sletter eller tilbakefører databehandler alle personopplysninger
etter behandlingsansvarliges valg, senest 90 dager etter opphør, med mindre
lagring er pålagt i lov.

## 12. Lovvalg
Norsk rett. Verneting er ${P.legalName} sitt hjemting.`;

const PERSONVERN = `# Personvernerklæring for brukere av Leadgrid

${P.legalName}, org.nr ${P.orgNumber}, er behandlingsansvarlig for
opplysninger om deg som bruker av tjenesten.

## Hva vi behandler om deg
Navn, e-postadresse og stilling, innloggingsmetode (Google eller LinkedIn),
hvilken organisasjon du tilhører, og hva du gjør i tjenesten — innlogginger,
søk, godkjenninger og endringer. Vi lagrer også IP-adresse ved innlogging og
ved signering av avtaler.

## Hvorfor
For å gi deg tilgang, for å drifte og sikre tjenesten, og for å kunne vise
hvem som gjorde hva. Grunnlaget er avtalen med din arbeidsgiver og vår
berettigede interesse i sikker drift.

## Hvor lenge
Så lenge du har en konto, og i inntil 12 måneder etter at kontoen avsluttes.
Sikkerhetslogger lagres i inntil 12 måneder.

## Dine rettigheter
Du har rett til innsyn, retting, sletting, begrensning og dataportabilitet,
og til å protestere mot behandlingen. Henvendelser sendes til
${P.legalName}. Du kan klage til Datatilsynet.

## Merk
Denne erklæringen gjelder opplysninger om DEG som bruker. Opplysninger om
virksomhetene og kontaktpersonene du arbeider med i tjenesten, er det din
arbeidsgiver som er behandlingsansvarlig for — der er vi databehandler, og
det reguleres av databehandleravtalen.`;

const INTENSJONSAVTALE = `# Intensjonsavtale

Mellom kunden og **${P.legalName}**, org.nr ${P.orgNumber}.

## 1. Formål
Partene vil prøve ut Leadgrid i kundens salgsarbeid, og vurdere et løpende
kundeforhold på grunnlag av erfaringene.

## 2. Prøveperiode
Kunden får full tilgang i sju dager. Perioden starter når kunden gjennomfører
sitt første søk i tjenesten, ikke ved registrering — slik måles sju dager med
produktet, ikke sju dager på kalenderen. Tilgangen utløper uansett 30 dager
etter registrering dersom tjenesten ikke tas i bruk.

## 3. Etter prøveperioden
Velger kunden ikke en avtale, blir tilgangen skrivebeskyttet: kunden ser sine
data, men kan ikke legge til nye. Data slettes ikke uten at kunden ber om det
eller kundeforholdet avsluttes.

## 4. Pris
Pris avtales før overgang til betalt abonnement. Prøveperioden er
kostnadsfri, og kunden pådrar seg ingen betalingsforpliktelse ved å signere
denne avtalen.

## 5. Uforpliktende
Avtalen forplikter ingen av partene til å inngå videre avtale.

## 6. Taushetsplikt
Partene behandler forretningsopplysninger de får kjennskap til
konfidensielt.

## 7. Behandling av personopplysninger
Reguleres av egen databehandleravtale, som må være signert før tjenesten tas
i bruk.`;

export const AGREEMENT_DOCUMENTS: Record<AgreementType, AgreementDocument> = {
  dpa: {
    type: "dpa",
    title: "Databehandleravtale",
    version: "2026-09-24",
    summary:
      `Regulerer hvordan ${P.legalName} behandler personopplysninger på dine vegne. ` +
      "Påkrevd etter personvernforordningen artikkel 28 før tjenesten tas i bruk.",
    required: true,
    confirmsBilling: false,
    body: DPA,
  },
  privacy: {
    type: "privacy",
    title: "Personvernerklæring",
    version: "2026-09-24",
    summary:
      "Hva vi behandler om deg som bruker — ikke om virksomhetene du arbeider med.",
    required: true,
    confirmsBilling: false,
    body: PERSONVERN,
  },
  loi: {
    type: "loi",
    title: "Intensjonsavtale",
    version: "2026-09-24",
    summary:
      "Rammen for prøveperioden. Uforpliktende, og uten betalingsforpliktelse.",
    required: true,
    // Fakturaopplysningene bekreftes her, fordi det er her kunden uansett
    // leser gjennom og signerer noe.
    confirmsBilling: true,
    body: INTENSJONSAVTALE,
  },
  terms: {
    type: "terms",
    title: "Generelle vilkår",
    version: "2026-09-24",
    summary: "Alminnelige vilkår for bruk av tjenesten.",
    required: false,
    confirmsBilling: false,
    body: `# Generelle vilkår\n\nLeveres av ${P.legalName}, org.nr ${P.orgNumber}.`,
  },
};

export function agreementDocument(type: string): AgreementDocument | null {
  return (AGREEMENT_DOCUMENTS as Record<string, AgreementDocument>)[type] ?? null;
}
