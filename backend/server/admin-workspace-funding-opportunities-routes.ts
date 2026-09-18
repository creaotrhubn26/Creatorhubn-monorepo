/**
 * Støttefrist-radar for Admin Workspace.
 *
 * Holder eksterne støtteordninger adskilt fra egne søknader. Hver rad har
 * offisiell kilde og tidspunkt for siste manuelle/kuraterte verifisering.
 */

import type { Pool } from "pg";
import type { AdminRoomRoutesDeps } from "./_shared";
import { asString, readBoolean, readStringArray } from "./_shared";

const VALID_PRODUCTS = new Set(["role_room", "leadgrid"]);
const VALID_STATUSES = new Set([
  "watching",
  "planned",
  "applying",
  "submitted",
  "not_relevant",
  "closed",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

class FundingOpportunityInputError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

const OPPORTUNITY_SELECT = `
  SELECT id::text, user_id, product_key, catalog_key, provider, scheme_name,
         description, deadline::text, is_rolling, deadline_note, status,
         source_url, application_url, last_verified_at::text,
         next_check_date::text, assignee, fit_notes, tags, metadata,
         created_at::text, updated_at::text
    FROM admin_workspace_funding_opportunities
`;

const CURATED_OPPORTUNITIES = [
  {
    catalogKey: "innovation-norway-startup-grant-1",
    provider: "Innovasjon Norge",
    schemeName: "Oppstartstilskudd 1",
    description:
      "Tilskudd for å teste om det finnes et betalingsvillig marked for en innovativ forretningsidé.",
    deadline: null,
    isRolling: true,
    deadlineNote:
      "Løpende søknadsfrist. Offisiell side oppga dette 28. august 2026.",
    sourceUrl: "https://www.innovasjonnorge.no/tjeneste/oppstartstilskudd-1",
    tags: ["innovasjon-norge", "oppstart", "marked"],
  },
  {
    catalogKey: "innovation-norway-startup-grant-2",
    provider: "Innovasjon Norge",
    schemeName: "Oppstartstilskudd 2",
    description:
      "Tilskudd til tekniske og forretningsmessige avklaringer for oppstartsbedrifter med vekstpotensial.",
    deadline: null,
    isRolling: true,
    deadlineNote:
      "Løpende søknadsfrist. Offisiell side oppga dette 28. august 2026.",
    sourceUrl: "https://www.innovasjonnorge.no/tjeneste/oppstartstilskudd-2",
    tags: ["innovasjon-norge", "oppstart", "teknologi"],
  },
  {
    catalogKey: "research-council-skattefunn-2026",
    provider: "Forskningsrådet",
    schemeName: "SkatteFUNN 2026 — garantifrist",
    description:
      "Søknader senest garantifristen er garantert behandling i 2026 og kan gi skattefradrag for søknadsåret.",
    deadline: "2026-09-01",
    isRolling: false,
    deadlineNote:
      "Garantifrist 1. september 2026. Det er mulig å søke senere, men behandling samme år er da ikke garantert.",
    sourceUrl:
      "https://www.forskningsradet.no/utlysninger/2026/skattefunn-skattefradrag-for-forskning-og-utvikling-i-et-nyskapende-naringsliv/",
    tags: ["forskningsrådet", "skattefunn", "fou"],
  },
  {
    catalogKey: "research-council-ipn-services-2026",
    provider: "Forskningsrådet",
    schemeName:
      "Innovasjonsprosjekt i næringslivet — industri og tjenestenæringer 2026",
    description:
      "Forskningsbasert innovasjon for blant annet IKT- og tjenestenæringer.",
    deadline: null,
    isRolling: true,
    deadlineNote:
      "Løpende søknadsbehandling. Utlysningen kan stenge når midlene er brukt opp.",
    sourceUrl:
      "https://www.forskningsradet.no/utlysninger/2026/innovasjonsprosjekt-naringslivet-industri-og-tjenestenaringer/",
    tags: ["forskningsrådet", "ipn", "ikt", "innovasjon"],
  },
] as const;

const OPPSTART_1_TASKS = [
  [
    "Avgrens én forretningsidé og innovasjonshøyden",
    "Beskriv hva som er vesentlig nytt, hvilket problem som løses og hvorfor eksisterende alternativer ikke er tilstrekkelige.",
    2,
  ],
  [
    "Samle dokumentert kundeinnsikt",
    "Logg reelle, relevante kundesamtaler: konkret situasjon, dagens løsning, konsekvens og hva som var annerledes enn antatt. Innovasjon Norge publiserer ingen fast minimumsgrense.",
    6,
  ],
  [
    "Dokumenter betalingsvilje",
    "Skaff prisreaksjoner, pilotinteresse, intensjonsbrev eller annen evidens på at markedet vil betale.",
    9,
  ],
  [
    "Kartlegg konkurrenter og substitutter",
    "Sammenlign direkte konkurrenter, manuelle alternativer og kundens valg om å ikke gjøre noe.",
    6,
  ],
  [
    "Estimer nasjonalt og internasjonalt marked",
    "Bygg et etterprøvbart TAM/SAM/SOM-estimat og forklar skalerbarheten utenfor Norge.",
    8,
  ],
  [
    "Definer markedsavklaringsprosjektet",
    "Velg aktiviteter, hypoteser, måltall, milepæler og stopp-/fortsett-kriterier som tilskuddet skal finansiere.",
    11,
  ],
  [
    "Bygg budsjett og finansieringsplan",
    "Knytt hver fremtidige eksterne kostnad til markedstesten, navngi leverandør og oppgi all annen offentlig støtte. Egen tid, inngående MVA og nærstående leverandører er ikke støtteberettiget.",
    13,
  ],
  [
    "Dokumenter team, IPR, risiko og bærekraft",
    "Vis gjennomføringsevne, rettigheter, teknisk/kommersiell risiko og hvordan ansvarlig næringsliv ivaretas.",
    14,
  ],
  [
    "Skriv komplett førsteutkast",
    "Fyll alle seksjoner med dokumenterte påstander og lenker til underlag. Fjern generelle salgsformuleringer.",
    17,
  ],
  [
    "Kvalitetssikre og sende",
    "Kontroller samsvar mellom problem, markedstest, aktiviteter og budsjett. Be eventuelt Innovasjon Norge om rask avklaring før innsending.",
    21,
  ],
] as const;

const OPPSTART_1_DOCUMENT = `# Oppstartstilskudd 1 — søknadsutkast

Søker: Creatorhub AS
Forretningsidé: Leadgrid
Søknadsbeløp: 150 000 kroner
Intern målfrist: 18. september 2026

Dette arbeidsdokumentet skal bli den faktiske søknaden. Det følger Innovasjon Norges offisielle Oppstartstilskudd 1-side, kundeinnsiktsveiledning og presentasjonen «Fra idé til marked», kontrollert 28. august 2026. Portalens ordlyd og tegnbegrensninger må sammenlignes med Min side før innsending.

Offisielle kilder:
- Ordningen: https://www.innovasjonnorge.no/tjeneste/oppstartstilskudd-1
- Veiledning: https://cdn.sanity.io/files/loal7n8w/inno-prod/bc7103bdd2d6fb7757272dffb35b336b88d3f9a5.xlsx
- Fra idé til marked: https://cdn.sanity.io/files/loal7n8w/inno-prod/90b189cd583cd739871c871da276358a9922418c.pdf
- Søknadsportal: https://start.innovasjonnorge.no/

## 0. Kvalifiseringssjekk

Kryss av med x først når påstanden er dokumentert.

- [ ] Creatorhub er etablert som aksjeselskap.
- [ ] Selskapet er yngre enn tre år, eller omfattes dokumentert av unntaket på inntil fem år.
- [ ] Dette er en reell nyetablering og ikke en spin-off fra en eksisterende bedrift.
- [ ] Selskapet har ingen betalingsanmerkninger.
- [ ] Leadgrid er noe nytt eller vesentlig bedre for kunden, ikke en standardimplementering.
- [ ] Selskapet har et krevende teknologiutviklingsløp med reell teknisk usikkerhet foran seg.
- [ ] Teamet har relevant kompetanse og kapasitet.
- [ ] Markedspotensialet og vekstambisjonene er betydelige nasjonalt og internasjonalt.
- [ ] Problemforståelsen bygger på samtaler med reelle, relevante kunder eller brukere.
- [ ] Dagens alternativer, inkludert manuelle løsninger og å gjøre ingenting, er kartlagt.
- [ ] Prosjektet skal teste markedsantakelser, ikke bygge en ferdig løsning.
- [ ] Tilskuddet er utløsende og erstatter ikke allerede planlagt arbeid eller privat kapital.

Selskapsopplysninger:
- Organisasjonsnummer: [MÅ FYLLES UT]
- Stiftelsesdato: [MÅ FYLLES UT]
- Forretningsadresse og fylke: [MÅ FYLLES UT]
- Kontaktperson, rolle, telefon og e-post: [MÅ FYLLES UT]
- Eiere og eierandeler: [MÅ FYLLES UT]

## Søknadssammendrag

Skriv dette til slutt: problem, kundegruppe, ny løsning, viktigste dokumenterte innsikt, hva prosjektet skal avklare, aktivitet og søknadsbeløp.

**Søknadstekst:**
[MÅ FYLLES UT]

## 1. Ideen — problem og kundeinnsikt

Hører hjemme under «Ideen». Innovasjon Norge forventer hvem dere har snakket med, problemet i praksis, konkrete eksempler og hva som går igjen. Unngå udokumenterte «vi tror»-påstander.

- Avgrenset kundegruppe med sterkest problem: [MÅ FYLLES UT]
- Hvem opplever, hvem bestemmer og hvem betaler: [MÅ FYLLES UT]
- Når og hvor problemet oppstår: [MÅ FYLLES UT]
- Konsekvens i tid, penger, arbeid, kvalitet eller risiko: [MÅ FYLLES UT]

| Dato | Virksomhet / rolle | Konkret situasjon | Dagens handling | Konsekvens | Hva lærte vi? |
|---|---|---|---|---|---|
| [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] |

Tre til fem funn som går igjen:
1. [MÅ FYLLES UT]
2. [MÅ FYLLES UT]
3. [MÅ FYLLES UT]

Innovasjon Norges arbeidsbok har plass til 15 samtaler, men oppgir ikke et obligatorisk minimum. Full samtalelogg legges ved.

**Søknadstekst:**
[MÅ FYLLES UT]

## 2. Dagens alternativer og konkurrenter

Beskriv først hva kunden faktisk gjør i dag: kjøper, gjør manuelt, setter sammen systemer, endrer arbeidsmåten eller gjør ingenting.

| Alternativ / løsning | Hvem bruker det? | Hva fungerer? | Hva fungerer dårlig? | Konsekvens | Kilde |
|---|---|---|---|---|---|
| [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] |

- Hva må kunden slutte med, bytte ut eller endre for å bruke Leadgrid? [MÅ FYLLES UT]
- Hvilket konkret gap gir rom for en bedre løsning? [MÅ FYLLES UT]
- Hva gjør Leadgrid konkret bedre? [MÅ FYLLES UT]

**Søknadstekst:**
[MÅ FYLLES UT]

## 3. Nyhetsverdi — løsning og krevende teknologiutvikling

Hører hjemme under «Nyhetsverdi». Beskriv produktet, kundeverdien, hva som er teknisk krevende, hvor usikkerheten ligger og vis systemarkitektur som vedlegg.

- Hva er Leadgrid, konkret og uten markedsføringsspråk? [MÅ FYLLES UT]
- Hvordan bruker kunden løsningen fra start til resultat? [MÅ FYLLES UT]
- Hvilken målbar verdi skal kunden få? [MÅ FYLLES UT]
- Hva er helt nytt eller vesentlig forbedret? [MÅ FYLLES UT]
- Hvorfor er dette ikke en standardimplementering av kjent teknologi? [MÅ FYLLES UT]
- Hvilke tekniske utfordringer og usikkerheter krever utvikling, testing og iterasjon? [MÅ FYLLES UT]
- Hva kan vise seg å ikke fungere? [MÅ FYLLES UT]

**Søknadstekst:**
[MÅ FYLLES UT]

## 4. Langsiktige mål — marked og vekst

Hører hjemme under «Langsiktige mål / tilleggsinfo». Vis hvem kunden er, hvordan markedet er beregnet, startsegmentet, kundetilgang og internasjonalt potensial.

- Første målsegment og hvorfor: [MÅ FYLLES UT]
- Beslutningstaker og betalingsansvarlig: [MÅ FYLLES UT]
- Pris- og betalingsmodell: [MÅ FYLLES UT]
- TAM, SAM og SOM med kilder og beregningsmåte: [MÅ FYLLES UT]
- Plan for å nå de første kundene: [MÅ FYLLES UT]
- Nasjonalt vekstscenario: [MÅ FYLLES UT]
- Internasjonale markeder og konkurransefortrinn: [MÅ FYLLES UT]
- Realistiske mål for verdiskaping og sysselsetting: [MÅ FYLLES UT]

**Søknadstekst:**
[MÅ FYLLES UT]

## 5. Fremdrift og aktiviteter — markedsavklaringsprosjektet

Hører hjemme under «Fremdrift og aktiviteter». Prosjektet skal teste, ikke bygge ferdig. Bruk logikken usikkerhet → aktivitet → kundebidrag → observerbart signal → læring / beslutning.

Prosjektlogikk: Vi har lært at [MÅ FYLLES UT]. Vi er fortsatt usikre på [MÅ FYLLES UT]. Vi vil kjøpe [MÅ FYLLES UT] for å gjennomføre [MÅ FYLLES UT] med [MÅ FYLLES UT]. Vi vil se etter [MÅ FYLLES UT], slik at vi kan avgjøre [MÅ FYLLES UT].

| Usikkerhet | Aktivitet med reelle kunder | Kundens bidrag | Signal / måltall | Beslutning | Frist |
|---|---|---|---|---|---|
| [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] |

- Fortsett dersom: [MÅ FYLLES UT]
- Endre retning dersom: [MÅ FYLLES UT]
- Stopp dersom: [MÅ FYLLES UT]
- Dokumentasjon ved prosjektslutt: [MÅ FYLLES UT]

**Søknadstekst:**
[MÅ FYLLES UT]

## 6. Kostnader, leverandører og finansiering

Ordningen kan dekke inntil 100 prosent av fremtidige eksterne kostnader dokumentert med faktura, innenfor 150 000 kroner. Den dekker ikke egen lønn eller tid, nærstående leverandører, inngående MVA eller kostnader påløpt før søknaden er sendt.

| Ekstern tjeneste | Leverandør | Kobling til testen | Leveranse | Kostnad eks. MVA | Finansiering |
|---|---|---|---|---:|---|
| [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] | Oppstartstilskudd 1 |

- Hvorfor kan tjenesten ikke utføres som ordinær egeninnsats? [MÅ FYLLES UT]
- Totale støtteberettigede kostnader eks. MVA: [MÅ FYLLES UT]
- Søknadsbeløp: 150 000 kroner
- Egenfinansiering / privat finansiering: [MÅ FYLLES UT]
- All annen offentlig støtte, inkludert SkatteFUNN: [MÅ FYLLES UT]
- Bekreft at samme kostnad ikke dobbelfinansieres: [MÅ FYLLES UT]

**Søknadstekst:**
[MÅ FYLLES UT]

## 7. Team og gjennomføringsevne

| Person | Rolle og kapasitet | Relevant erfaring | Ansvar i prosjektet |
|---|---|---|---|
| [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] |

- Manglende kompetanse og hvordan den dekkes: [MÅ FYLLES UT]
- Kritiske partnere, rådgivere eller leverandører: [MÅ FYLLES UT]
- Teamets kapasitet i prosjektperioden: [MÅ FYLLES UT]

**Søknadstekst:**
[MÅ FYLLES UT]

## 8. IPR, risiko, bærekraft og ansvarlig næringsliv

- Eierskap til programvare, data, design, varemerke og resultater: [MÅ FYLLES UT]
- Avtaler med ansatte, utviklere og leverandører: [MÅ FYLLES UT]
- Plan for beskyttelse og fortrolig informasjon: [MÅ FYLLES UT]

| Risiko | Sannsynlighet / konsekvens | Tiltak | Hva skal prosjektet avklare? |
|---|---|---|---|
| [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] | [MÅ FYLLES UT] |

- Positiv og negativ påvirkning på mennesker, samfunn og miljø: [MÅ FYLLES UT]
- Personvern, sikkerhet, AI-/automatiseringsrisiko og ansvarlig databruk: [MÅ FYLLES UT]
- Tiltak for ansvarlig næringsliv og redusert bærekraftsrisiko: [MÅ FYLLES UT]

**Søknadstekst:**
[MÅ FYLLES UT]

## 9. Vedlegg og sluttkontroll

- [ ] Systemarkitektur eller tydelig løsningsskisse.
- [ ] Kundeinnsiktslogg med konkrete eksempler og hovedfunn.
- [ ] Dagens alternativer og relevante konkurrenter.
- [ ] Markedsberegning med kilder.
- [ ] Tilbud eller kostnadsunderlag fra eksterne leverandører.
- [ ] Eventuell pilotinteresse, intensjonsbrev eller observerbare markedssignaler.
- [ ] Team-/CV-underlag og roller.
- [ ] Oversikt over annen offentlig støtte og kostnadsavgrensning.

Kontroller at problemet, nyhetsverdien, markedstesten og budsjettet beskriver samme prosjekt. Alle kundepåstander må ha dokumentasjon, hver aktivitet må gi læring, og hver kostnad må være ekstern, fremtidig, eks. MVA og direkte knyttet til testen.

**Søknadstekst / liste over innsendte vedlegg:**
[MÅ FYLLES UT]

## Vedlegg A — rammer og tidligere arbeidsnotater

- Formål: avklare om det finnes et betalingsvillig marked for en innovativ forretningsidé.
- Målgruppe: innovative oppstartsbedrifter med krevende teknologiutviklingsløp og betydelig markeds- og vekstpotensial nasjonalt og internasjonalt.
- Søknadsfrist: løpende.
- Maksimalt tilskudd: 150 000 kroner.
- Offisiell oppgitt behandlingstid: 3–4 uker per 28. august 2026.
- Offisiell kilde: https://www.innovasjonnorge.no/tjeneste/oppstartstilskudd-1

### A.1 Kvalifiseringssjekk

- [ ] Selskapet er en reell, innovativ oppstartsbedrift med vekstambisjon.
- [ ] Løsningen representerer noe vesentlig nytt, ikke bare ordinær produktutvikling eller drift.
- [ ] Teknologiutviklingsløpet er krevende og har reell risiko.
- [ ] Markedspotensialet er betydelig i Norge og internasjonalt.
- [ ] Prosjektets hovedmål er å teste marked og betalingsvilje.
- [ ] Annen offentlig støtte, inkludert SkatteFUNN, er kartlagt og oppgis uten dobbel finansiering av samme kostnad.
- [ ] Bærekraftsrisiko og prinsipper for ansvarlig næringsliv er vurdert.

### A.2 Kort sammendrag

[Problem + målgruppe + vesentlig ny løsning + hva som skal bevises + ønsket tilskudd.]

### A.3 Problemet og kunden

- Hvem har problemet?
- Hvordan løses det i dag?
- Hva koster problemet i tid, penger eller tapt kvalitet?
- Hvilke kundesamtaler og observasjoner dokumenterer behovet?

### A.4 Løsningen og innovasjonshøyden

- Hva er nytt sammenlignet med direkte konkurrenter og substitutter?
- Hvorfor er løsningen vanskelig å kopiere?
- Hvilke tekniske og kommersielle hypoteser er fortsatt uavklart?
- Hvilke IPR-, data- eller teknologirettigheter kontrollerer selskapet?

### A.5 Marked, betalingsvilje og internasjonalt potensial

- TAM / SAM / SOM med kilder og forutsetninger.
- Målsegment og beslutningstaker.
- Pris- og betalingshypotese.
- Dokumentasjon: intervjuer, pilotdialoger, intensjonsbrev, førbestillinger eller pristester.
- Hvorfor kan løsningen skaleres internasjonalt?

### A.6 Markedsavklaringsprosjektet

| Aktivitet | Hypotese | Leveranse | Måltall | Ansvarlig | Frist |
|---|---|---|---|---|---|
| Kundetest | [hypotese] | [leveranse] | [KPI] | [navn] | [dato] |

Definer eksplisitte fortsett-, endre- og stoppkriterier.

### A.7 Gjennomføringsevne og risiko

- Teamets relevante erfaring og kapasitet.
- Kritiske avhengigheter og partnere.
- Teknisk risiko, markedsrisiko og mottiltak.
- Bærekraft, ansvarlig næringsliv og vesentlig negativ påvirkning.

### A.8 Budsjett og finansiering

| Kostnad | Beløp | Hvorfor nødvendig for markedsavklaring | Finansieringskilde |
|---|---:|---|---|
| [aktivitet] | 0 | [begrunnelse] | Oppstartstilskudd / egenfinansiering |

- Søknadsbeløp: [inntil 150 000 kr]
- Egenfinansiering: [beløp og kilde]
- Annen offentlig støtte søkt/mottatt: [ordning, kostnader og beløp]

### A.9 Forventet resultat og neste beslutning

[Hvilken dokumentasjon skal foreligge ved prosjektslutt, og hvilken investerings-/produktbeslutning muliggjør den?]

### A.10 Evidens og vedlegg

- [ ] Intervjulogg og kundesitater
- [ ] Konkurrentkart
- [ ] Markedsstørrelse med kilder
- [ ] Pilot-/LOI-dokumentasjon
- [ ] Aktivitets- og budsjettunderlag
- [ ] Team/CV og relevant gjennomføring
- [ ] Oversikt over offentlig støtte
`;

export function buildOppstartApplicationDocument(
  productKey: string | null,
  targetDate: string,
): string {
  const productName =
    productKey === "role_room"
      ? "The Role Room"
      : productKey === "leadgrid"
        ? "Leadgrid"
        : "forretningsideen";
  const targetLabel = new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Oslo",
  }).format(new Date(`${targetDate}T12:00:00.000Z`));
  return OPPSTART_1_DOCUMENT.replaceAll("Leadgrid", productName).replace(
    "18. september 2026",
    targetLabel,
  );
}

function limitedText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null {
  const text = asString(value);
  if (text && text.length > maxLength) {
    throw new FundingOpportunityInputError(
      400,
      `${field} kan være maks ${maxLength} tegn`,
    );
  }
  return text;
}

function validDate(value: unknown, field: string): string | null {
  const raw = asString(value);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(raw)) {
    throw new FundingOpportunityInputError(
      400,
      `${field} må være på formatet YYYY-MM-DD`,
    );
  }
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== raw
  ) {
    throw new FundingOpportunityInputError(
      400,
      `${field} må være en gyldig dato`,
    );
  }
  return raw;
}

function validTimestamp(value: unknown, field: string): Date | null {
  const raw = asString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    throw new FundingOpportunityInputError(
      400,
      `${field} må være et gyldig ISO-tidspunkt`,
    );
  }
  return parsed;
}

function validHttpUrl(
  value: unknown,
  field: string,
  required = false,
): string | null {
  const raw = limitedText(value, field, 2_000);
  if (!raw) {
    if (required)
      throw new FundingOpportunityInputError(400, `${field} er påkrevd`);
    return null;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:")
      throw new Error("protocol");
    return url.toString();
  } catch {
    throw new FundingOpportunityInputError(
      400,
      `${field} må være en gyldig http/https-URL`,
    );
  }
}

function normalizedTags(value: unknown): string[] {
  return readStringArray(value)
    .map((tag) => tag.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 20);
}

async function fetchOpportunity(
  pool: Pool,
  id: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const result = await pool.query(
    `${OPPORTUNITY_SELECT} WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return result.rows[0] ?? null;
}

function sendInputError(
  res: Parameters<AdminRoomRoutesDeps["requireAdminRoomAccess"]>[1],
  error: unknown,
): boolean {
  if (!(error instanceof FundingOpportunityInputError)) return false;
  res.status(error.statusCode).json({ error: error.message });
  return true;
}

export function setupAdminWorkspaceFundingOpportunityRoutes(
  deps: AdminRoomRoutesDeps,
): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  app.get(
    "/api/admin-room/workspace/funding-opportunities",
    async (req, res) => {
      const session = requireAdminRoomAccess(req, res);
      if (!session) return;
      const product = asString(req.query.product);
      if (
        product &&
        product !== "internal" &&
        product !== "all" &&
        !VALID_PRODUCTS.has(product)
      ) {
        res.status(400).json({ error: "Ugyldig product-filter" });
        return;
      }
      const params: unknown[] = [session.userId];
      let productSql = "TRUE";
      if (product === "internal") productSql = "product_key IS NULL";
      else if (product && product !== "all") {
        params.push(product);
        productSql = `(product_key IS NULL OR product_key = $${params.length})`;
      }
      try {
        const result = await pool.query(
          `${OPPORTUNITY_SELECT}
          WHERE user_id = $1 AND ${productSql}
          ORDER BY CASE status WHEN 'applying' THEN 0 WHEN 'planned' THEN 1 WHEN 'watching' THEN 2 ELSE 3 END,
                   deadline ASC NULLS LAST, updated_at DESC`,
          params,
        );
        res.json({ items: result.rows });
      } catch (error) {
        console.error(
          "[admin-workspace funding-opportunities] list error",
          error,
        );
        res.status(500).json({ error: "Kunne ikke hente støtteordningene" });
      }
    },
  );

  app.post(
    "/api/admin-room/workspace/funding-opportunities/seed",
    async (req, res) => {
      const session = requireAdminRoomAccess(req, res);
      if (!session) return;
      try {
        for (const item of CURATED_OPPORTUNITIES) {
          await pool.query(
            `INSERT INTO admin_workspace_funding_opportunities
            (user_id, catalog_key, provider, scheme_name, description, deadline,
             is_rolling, deadline_note, status, source_url, application_url,
             last_verified_at, next_check_date, tags, metadata, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'watching', $9, $9,
                   NOW(), CURRENT_DATE + 14, $10, $11::jsonb, $1)
           ON CONFLICT (user_id, catalog_key) WHERE catalog_key IS NOT NULL
           DO UPDATE SET provider = EXCLUDED.provider,
                         scheme_name = EXCLUDED.scheme_name,
                         description = EXCLUDED.description,
                         deadline = EXCLUDED.deadline,
                         is_rolling = EXCLUDED.is_rolling,
                         deadline_note = EXCLUDED.deadline_note,
                         source_url = EXCLUDED.source_url,
                         application_url = EXCLUDED.application_url,
                         last_verified_at = NOW(),
                         next_check_date = CURRENT_DATE + 14,
                         tags = EXCLUDED.tags,
                         metadata = admin_workspace_funding_opportunities.metadata || EXCLUDED.metadata,
                         updated_at = NOW(),
                         updated_by = $1`,
            [
              session.userId,
              item.catalogKey,
              item.provider,
              item.schemeName,
              item.description,
              item.deadline,
              item.isRolling,
              item.deadlineNote,
              item.sourceUrl,
              [...item.tags],
              JSON.stringify({
                curatedAsOf: "2026-08-28",
                officialSource: true,
              }),
            ],
          );
        }
        await logAdminActivity({
          userId: session.userId,
          entityType: "workspace_funding_opportunity",
          entityId: null,
          action: "seeded",
          summary: `${CURATED_OPPORTUNITIES.length} offisielt kontrollerte støtteordninger oppdatert`,
        });
        const result = await pool.query(
          `${OPPORTUNITY_SELECT} WHERE user_id = $1 ORDER BY deadline ASC NULLS LAST`,
          [session.userId],
        );
        res.json({ items: result.rows, seeded: CURATED_OPPORTUNITIES.length });
      } catch (error) {
        console.error(
          "[admin-workspace funding-opportunities] seed error",
          error,
        );
        res
          .status(500)
          .json({ error: "Kunne ikke legge inn standardordningene" });
      }
    },
  );

  app.post(
    "/api/admin-room/workspace/funding-opportunities",
    async (req, res) => {
      const session = requireAdminRoomAccess(req, res);
      if (!session) return;
      const body = (req.body ?? {}) as Record<string, unknown>;
      try {
        const provider = limitedText(body.provider, "provider", 160);
        const schemeName = limitedText(body.schemeName, "schemeName", 240);
        if (!provider || !schemeName)
          throw new FundingOpportunityInputError(
            400,
            "provider og schemeName er påkrevd",
          );
        const rawProduct = asString(body.productKey);
        if (rawProduct && !VALID_PRODUCTS.has(rawProduct))
          throw new FundingOpportunityInputError(400, "Ugyldig productKey");
        const status = asString(body.status, "watching") ?? "watching";
        if (!VALID_STATUSES.has(status))
          throw new FundingOpportunityInputError(400, "Ugyldig status");
        const inserted = await pool.query<{ id: string }>(
          `INSERT INTO admin_workspace_funding_opportunities
          (user_id, product_key, provider, scheme_name, description, deadline,
           is_rolling, deadline_note, status, source_url, application_url,
           last_verified_at, next_check_date, assignee, fit_notes, tags, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$1)
         RETURNING id::text`,
          [
            session.userId,
            rawProduct,
            provider,
            schemeName,
            limitedText(body.description, "description", 20_000),
            validDate(body.deadline, "deadline"),
            readBoolean(body.isRolling) ?? false,
            limitedText(body.deadlineNote, "deadlineNote", 500),
            status,
            validHttpUrl(body.sourceUrl, "sourceUrl", true),
            validHttpUrl(body.applicationUrl, "applicationUrl"),
            validTimestamp(body.lastVerifiedAt, "lastVerifiedAt"),
            validDate(body.nextCheckDate, "nextCheckDate"),
            limitedText(body.assignee, "assignee", 160),
            limitedText(body.fitNotes, "fitNotes", 20_000),
            normalizedTags(body.tags),
          ],
        );
        const item = await fetchOpportunity(
          pool,
          inserted.rows[0].id,
          session.userId,
        );
        await logAdminActivity({
          userId: session.userId,
          entityType: "workspace_funding_opportunity",
          entityId: inserted.rows[0].id,
          action: "created",
          summary: `Støtteordning registrert: ${provider} · ${schemeName}`,
        });
        res.status(201).json({ item });
      } catch (error) {
        if (sendInputError(res, error)) return;
        console.error(
          "[admin-workspace funding-opportunities] create error",
          error,
        );
        res.status(500).json({ error: "Kunne ikke opprette støtteordningen" });
      }
    },
  );

  app.post(
    "/api/admin-room/workspace/funding-opportunities/:id/start-plan",
    async (req, res) => {
      const session = requireAdminRoomAccess(req, res);
      if (!session) return;
      if (!UUID_PATTERN.test(req.params.id)) {
        res.status(400).json({ error: "Ugyldig støtteordnings-ID" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      let targetDate: string;
      let productKey: string | null;
      let projectTitle: string;
      try {
        const defaultTarget = new Date();
        defaultTarget.setUTCDate(defaultTarget.getUTCDate() + 21);
        targetDate =
          validDate(body.targetDate, "targetDate") ??
          defaultTarget.toISOString().slice(0, 10);
        const requestedProduct = asString(body.productKey);
        if (requestedProduct && !VALID_PRODUCTS.has(requestedProduct)) {
          throw new FundingOpportunityInputError(400, "Ugyldig productKey");
        }
        productKey = requestedProduct;
        projectTitle =
          limitedText(body.projectTitle, "projectTitle", 200) ??
          "Oppstartstilskudd 1 — markedsavklaring";
      } catch (error) {
        if (sendInputError(res, error)) return;
        throw error;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const opportunityResult = await client.query<{
          id: string;
          product_key: string | null;
          catalog_key: string | null;
          provider: string;
          scheme_name: string;
          metadata: Record<string, unknown>;
        }>(
          `SELECT id::text, product_key, catalog_key, provider, scheme_name, metadata
           FROM admin_workspace_funding_opportunities
          WHERE id = $1 AND user_id = $2
          FOR UPDATE`,
          [req.params.id, session.userId],
        );
        const opportunity = opportunityResult.rows[0];
        if (!opportunity) {
          await client.query("ROLLBACK");
          res.status(404).json({ error: "Støtteordningen finnes ikke" });
          return;
        }
        if (opportunity.catalog_key !== "innovation-norway-startup-grant-1") {
          await client.query("ROLLBACK");
          res
            .status(400)
            .json({
              error: "Denne søknadsplaybooken gjelder Oppstartstilskudd 1",
            });
          return;
        }

        const previousPlan = opportunity.metadata?.applicationPlan as
          | Record<string, unknown>
          | undefined;
        if (typeof previousPlan?.projectId === "string") {
          const activeProject = await client.query(
            "SELECT 1 FROM admin_workspace_projects WHERE id = $1 AND user_id = $2",
            [previousPlan.projectId, session.userId],
          );
          if (activeProject.rows.length) {
            await client.query("COMMIT");
            res.json({ plan: previousPlan, existing: true });
            return;
          }
        }

        const osloDate = new Date().toLocaleDateString("en-CA", {
          timeZone: "Europe/Oslo",
        });
        productKey = productKey ?? opportunity.product_key;
        const projectResult = await client.query<{ id: string }>(
          `INSERT INTO admin_workspace_projects
          (user_id, product_key, title, summary, objective, category, status,
           priority, progress_percent, start_date, target_date, tags, metadata, updated_by)
         VALUES ($1,$2,$3,$4,$5,'funding','active','urgent',5,$6,$7,$8,$9::jsonb,$1)
         RETURNING id::text`,
          [
            session.userId,
            productKey,
            projectTitle,
            "Bygge en evidensbasert søknad til Innovasjon Norge Oppstartstilskudd 1.",
            "Dokumentere en vesentlig ny forretningsidé, betalingsvillig marked og et avgrenset markedsavklaringsprosjekt.",
            osloDate,
            targetDate,
            ["innovasjon-norge", "oppstartstilskudd-1", "markedsavklaring"],
            JSON.stringify({
              fundingOpportunityId: opportunity.id,
              playbook: "oppstartstilskudd-1-v1",
            }),
          ],
        );
        const projectId = projectResult.rows[0].id;

        const taskRows = OPPSTART_1_TASKS.map(
          ([title, description, offset]) => {
            const due = new Date(`${osloDate}T00:00:00.000Z`);
            due.setUTCDate(due.getUTCDate() + offset);
            const target = new Date(`${targetDate}T00:00:00.000Z`);
            if (due > target) due.setTime(target.getTime());
            return {
              title,
              description,
              dueDate: due.toISOString().slice(0, 10),
            };
          },
        );
        const fundingResult = await client.query<{ id: string }>(
          `INSERT INTO admin_funding_apps
          (user_id, scheme, scheme_label, project_name, applicant_company, status,
           amount_requested, currency, description, milestones, budget_breakdown,
           deadline, notes, metadata)
         VALUES ($1,'innovasjon_norge_1','Innovasjon Norge — Oppstartstilskudd 1',$2,
                 'Creatorhub AS','draft',150000,'NOK',$3,$4::jsonb,'[]'::jsonb,
                 NULL,$5,$6::jsonb)
         RETURNING id::text`,
          [
            session.userId,
            projectTitle,
            "Arbeidsutkast for å dokumentere betalingsvillig marked, innovasjonshøyde og gjennomførbar markedsavklaring.",
            JSON.stringify(
              taskRows.map((task) => ({
                title: task.title,
                date: task.dueDate,
                description: task.description,
              })),
            ),
            "Ordningen har løpende frist. Intern målfrist ligger på adminprosjektet. Oppgi all annen offentlig støtte og unngå dobbel finansiering av samme kostnader.",
            JSON.stringify({
              fundingOpportunityId: opportunity.id,
              workspaceProjectId: projectId,
              officialSource:
                "https://www.innovasjonnorge.no/tjeneste/oppstartstilskudd-1",
            }),
          ],
        );
        const fundingAppId = fundingResult.rows[0].id;
        await client.query(
          `INSERT INTO admin_workspace_project_links (project_id, user_id, entity_type, entity_id)
         VALUES ($1,$2,'funding_app',$3)`,
          [projectId, session.userId, fundingAppId],
        );

        const documentTitle = projectTitle.startsWith("Oppstartstilskudd 1")
          ? projectTitle
          : `Oppstartstilskudd 1 — ${projectTitle}`;
        const applicationDocument = buildOppstartApplicationDocument(
          productKey,
          targetDate,
        );
        const documentResult = await client.query<{ id: string }>(
          `INSERT INTO admin_documents
          (user_id, product_key, title, summary, content, document_type, status,
           due_date, next_action, tags, source_kind, updated_by, metadata)
         VALUES ($1,$2,$3,$4,$5,'funding_application','draft',$6,$7,$8,'workspace',$1,$9::jsonb)
         RETURNING id::text`,
          [
            session.userId,
            productKey,
            documentTitle,
            "Kravsjekk, evidensbank og komplett søknadsstruktur for markedsavklaring.",
            applicationDocument,
            targetDate,
            "Avgrens én forretningsidé og fyll kvalifiseringssjekken med dokumentasjon.",
            ["innovasjon-norge", "oppstartstilskudd-1", "søknad"],
            JSON.stringify({
              fundingOpportunityId: opportunity.id,
              workspaceProjectId: projectId,
              fundingAppId,
              officialSource:
                "https://www.innovasjonnorge.no/tjeneste/oppstartstilskudd-1",
            }),
          ],
        );
        const documentId = documentResult.rows[0].id;
        await client.query(
          `INSERT INTO admin_document_versions
          (document_id, user_id, version_number, title, summary, content,
           document_type, status, product_key, due_date, next_action, tags,
           source_kind, change_note, created_by)
         VALUES ($1,$2,1,$3,$4,$5,'funding_application','draft',$6,$7,$8,$9,
                 'workspace','Oppstartstilskudd 1-playbook opprettet',$2)`,
          [
            documentId,
            session.userId,
            documentTitle,
            "Kravsjekk, evidensbank og komplett søknadsstruktur for markedsavklaring.",
            applicationDocument,
            productKey,
            targetDate,
            "Avgrens én forretningsidé og fyll kvalifiseringssjekken med dokumentasjon.",
            ["innovasjon-norge", "oppstartstilskudd-1", "søknad"],
          ],
        );
        await client.query(
          `INSERT INTO admin_document_links (document_id, user_id, entity_type, entity_id)
         VALUES ($1,$2,'workspace_project',$3), ($1,$2,'funding_app',$4)`,
          [documentId, session.userId, projectId, fundingAppId],
        );
        await client.query(
          `INSERT INTO admin_document_files
          (document_id, user_id, file_name, source_kind, external_url)
         VALUES
          ($1,$2,'Innovasjon Norge — Veiledning til Oppstartstilskudd 1','external',$3),
          ($1,$2,'Innovasjon Norge — Fra idé til marked','external',$4)`,
          [
            documentId,
            session.userId,
            "https://cdn.sanity.io/files/loal7n8w/inno-prod/bc7103bdd2d6fb7757272dffb35b336b88d3f9a5.xlsx",
            "https://cdn.sanity.io/files/loal7n8w/inno-prod/90b189cd583cd739871c871da276358a9922418c.pdf",
          ],
        );

        const taskIds: string[] = [];
        for (const task of taskRows) {
          const result = await client.query<{ id: string }>(
            `INSERT INTO admin_workspace_tasks
            (user_id, product_key, title, description, status, priority,
             due_date, project_id, tags, updated_by)
           VALUES ($1,$2,$3,$4,'todo','high',$5,$6,$7,$1)
           RETURNING id::text`,
            [
              session.userId,
              productKey,
              task.title,
              task.description,
              task.dueDate,
              projectId,
              ["oppstartstilskudd-1", "søknad"],
            ],
          );
          taskIds.push(result.rows[0].id);
        }

        const plan = {
          projectId,
          fundingAppId,
          documentId,
          taskIds,
          targetDate,
          createdAt: new Date().toISOString(),
        };
        const metadata = {
          ...(opportunity.metadata ?? {}),
          applicationPlan: plan,
          playbookVersion: 1,
        };
        await client.query(
          `UPDATE admin_workspace_funding_opportunities
            SET product_key = $1, status = 'applying', assignee = COALESCE(assignee, 'Daniel'),
                fit_notes = COALESCE(fit_notes, 'Aktivt mål: bygg dokumentert markedsavklaring og betalingsvilje.'),
                metadata = $2::jsonb, updated_at = NOW(), updated_by = $3
          WHERE id = $4 AND user_id = $3`,
          [
            productKey,
            JSON.stringify(metadata),
            session.userId,
            opportunity.id,
          ],
        );
        await client.query("COMMIT");
        await logAdminActivity({
          userId: session.userId,
          entityType: "workspace_funding_opportunity",
          entityId: opportunity.id,
          action: "application_plan_started",
          summary: `Søknadsløp opprettet: ${opportunity.scheme_name}`,
        });
        res.status(201).json({ plan, existing: false });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        if (sendInputError(res, error)) return;
        console.error(
          "[admin-workspace funding-opportunities] start plan error",
          error,
        );
        res.status(500).json({ error: "Kunne ikke opprette søknadsløpet" });
      } finally {
        client.release();
      }
    },
  );

  app.patch(
    "/api/admin-room/workspace/funding-opportunities/:id",
    async (req, res) => {
      const session = requireAdminRoomAccess(req, res);
      if (!session) return;
      if (!UUID_PATTERN.test(req.params.id)) {
        res.status(400).json({ error: "Ugyldig støtteordnings-ID" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      try {
        const exists = await pool.query(
          "SELECT 1 FROM admin_workspace_funding_opportunities WHERE id = $1 AND user_id = $2",
          [req.params.id, session.userId],
        );
        if (!exists.rows.length) {
          res.status(404).json({ error: "Støtteordningen finnes ikke" });
          return;
        }
        const sets: string[] = [];
        const params: unknown[] = [];
        const push = (column: string, value: unknown) => {
          params.push(value);
          sets.push(`${column} = $${params.length}`);
        };
        if ("provider" in body) {
          const v = limitedText(body.provider, "provider", 160);
          if (!v)
            throw new FundingOpportunityInputError(
              400,
              "provider kan ikke være tom",
            );
          push("provider", v);
        }
        if ("schemeName" in body) {
          const v = limitedText(body.schemeName, "schemeName", 240);
          if (!v)
            throw new FundingOpportunityInputError(
              400,
              "schemeName kan ikke være tom",
            );
          push("scheme_name", v);
        }
        if ("productKey" in body) {
          const v = asString(body.productKey);
          if (v && !VALID_PRODUCTS.has(v))
            throw new FundingOpportunityInputError(400, "Ugyldig productKey");
          push("product_key", v);
        }
        if ("description" in body)
          push(
            "description",
            limitedText(body.description, "description", 20_000),
          );
        if ("deadline" in body)
          push("deadline", validDate(body.deadline, "deadline"));
        if ("isRolling" in body)
          push("is_rolling", readBoolean(body.isRolling) ?? false);
        if ("deadlineNote" in body)
          push(
            "deadline_note",
            limitedText(body.deadlineNote, "deadlineNote", 500),
          );
        if ("status" in body) {
          const v = asString(body.status);
          if (!v || !VALID_STATUSES.has(v))
            throw new FundingOpportunityInputError(400, "Ugyldig status");
          push("status", v);
        }
        if ("sourceUrl" in body)
          push("source_url", validHttpUrl(body.sourceUrl, "sourceUrl", true));
        if ("applicationUrl" in body)
          push(
            "application_url",
            validHttpUrl(body.applicationUrl, "applicationUrl"),
          );
        if ("lastVerifiedAt" in body)
          push(
            "last_verified_at",
            validTimestamp(body.lastVerifiedAt, "lastVerifiedAt"),
          );
        if ("nextCheckDate" in body)
          push(
            "next_check_date",
            validDate(body.nextCheckDate, "nextCheckDate"),
          );
        if ("assignee" in body)
          push("assignee", limitedText(body.assignee, "assignee", 160));
        if ("fitNotes" in body)
          push("fit_notes", limitedText(body.fitNotes, "fitNotes", 20_000));
        if ("tags" in body) push("tags", normalizedTags(body.tags));
        if (!sets.length)
          throw new FundingOpportunityInputError(
            400,
            "Ingen felter å oppdatere",
          );
        sets.push("updated_at = NOW()");
        params.push(session.userId);
        sets.push(`updated_by = $${params.length}`);
        params.push(req.params.id, session.userId);
        await pool.query(
          `UPDATE admin_workspace_funding_opportunities SET ${sets.join(", ")} WHERE id = $${params.length - 1} AND user_id = $${params.length}`,
          params,
        );
        const item = await fetchOpportunity(
          pool,
          req.params.id,
          session.userId,
        );
        await logAdminActivity({
          userId: session.userId,
          entityType: "workspace_funding_opportunity",
          entityId: req.params.id,
          action: "updated",
          summary: `Støtteordning oppdatert: ${String(item?.scheme_name ?? req.params.id)}`,
        });
        res.json({ item });
      } catch (error) {
        if (sendInputError(res, error)) return;
        console.error(
          "[admin-workspace funding-opportunities] update error",
          error,
        );
        res.status(500).json({ error: "Kunne ikke oppdatere støtteordningen" });
      }
    },
  );

  app.delete(
    "/api/admin-room/workspace/funding-opportunities/:id",
    async (req, res) => {
      const session = requireAdminRoomAccess(req, res);
      if (!session) return;
      if (!UUID_PATTERN.test(req.params.id)) {
        res.status(400).json({ error: "Ugyldig støtteordnings-ID" });
        return;
      }
      try {
        const result = await pool.query<{ id: string; scheme_name: string }>(
          "DELETE FROM admin_workspace_funding_opportunities WHERE id = $1 AND user_id = $2 RETURNING id::text, scheme_name",
          [req.params.id, session.userId],
        );
        if (!result.rows.length) {
          res.status(404).json({ error: "Støtteordningen finnes ikke" });
          return;
        }
        await logAdminActivity({
          userId: session.userId,
          entityType: "workspace_funding_opportunity",
          entityId: result.rows[0].id,
          action: "deleted",
          summary: `Støtteordning slettet: ${result.rows[0].scheme_name}`,
        });
        res.json({ ok: true });
      } catch (error) {
        console.error(
          "[admin-workspace funding-opportunities] delete error",
          error,
        );
        res.status(500).json({ error: "Kunne ikke slette støtteordningen" });
      }
    },
  );
}
