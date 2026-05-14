/**
 * pageTemplates.ts
 *
 * Forhåndsdefinerte block-kombinasjoner ("page templates") som
 * lar admin starte med en polert struktur i stedet for å bygge
 * fra scratch. Hver mal returnerer en `Block[]` med plassholder-
 * tekst som er trygt å lagre og deretter editere.
 *
 * Inspirasjon fra Webflow Templates / Cloneables — vi kjører
 * en smal første runde med fire universalnyttige varianter.
 */

import { createBlock, type Block, type CtaBlock, type FaqBlock, type FeatureListBlock, type HeroBlock, type RelatedStudiesBlock, type RichTextBlock, type UsageExamplesBlock, type ComparisonBlock } from './blockSchema';

export type TemplateKind =
  | 'marketing-landing'
  | 'comparison-page'
  | 'press-kit'
  | 'education-landing'
  | 'simple-content';

export interface PageTemplate {
  key: TemplateKind;
  label: string;
  description: string;
  build: () => Block[];
}

function asHero(patch: Partial<HeroBlock>): HeroBlock {
  const b = createBlock('hero') as HeroBlock;
  return { ...b, ...patch };
}
function asFeatureList(patch: Partial<FeatureListBlock>): FeatureListBlock {
  const b = createBlock('featureList') as FeatureListBlock;
  return { ...b, ...patch };
}
function asUsage(patch: Partial<UsageExamplesBlock>): UsageExamplesBlock {
  const b = createBlock('usageExamples') as UsageExamplesBlock;
  return { ...b, ...patch };
}
function asFaq(patch: Partial<FaqBlock>): FaqBlock {
  const b = createBlock('faq') as FaqBlock;
  return { ...b, ...patch };
}
function asCta(patch: Partial<CtaBlock>): CtaBlock {
  const b = createBlock('cta') as CtaBlock;
  return { ...b, ...patch };
}
function asRichText(patch: Partial<RichTextBlock>): RichTextBlock {
  const b = createBlock('richText') as RichTextBlock;
  return { ...b, ...patch };
}
function asComparison(patch: Partial<ComparisonBlock>): ComparisonBlock {
  const b = createBlock('comparison') as ComparisonBlock;
  return { ...b, ...patch };
}
function asRelated(patch: Partial<RelatedStudiesBlock>): RelatedStudiesBlock {
  const b = createBlock('relatedStudies') as RelatedStudiesBlock;
  return { ...b, ...patch };
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    key: 'marketing-landing',
    label: 'Marketing landing',
    description: 'Hero · features-chips · use-cases · FAQ · CTA. Fungerer for produktsider og kampanjelandinger.',
    build: () => [
      asHero({
        audienceChip: 'For team og skapere',
        h1: 'Den raskeste veien til kvalitetsproduksjon',
        subtitle: 'Samle prosjekt, team og leveranser i ett rom — med norsk språk og GDPR-trygg datalagring.',
        intro: 'Bytt mellom prosjekter, send leveranser til kunde, og hold oversikt over hva som mangler — uten å hoppe mellom verktøy.',
        primaryCtaLabel: 'Kom i gang gratis',
        primaryCtaUrl: '/',
        secondaryCtaLabel: 'Se hvordan det fungerer',
        secondaryCtaUrl: '#features',
      }),
      asFeatureList({
        heading: 'Hva du får',
        items: [
          'Prosjektrom med team',
          'Klient-portal med leveranse-galleri',
          'Norsk språk + GDPR',
          'Integrert AI-agent',
          'Fakturering og abonnement',
          'Academy-kurs inkludert',
        ],
        style: 'chips',
      }),
      asUsage({
        heading: 'Når kan det brukes?',
        items: [
          { title: 'Tidlig fase', body: 'Sett opp ditt første prosjekt, inviter klient, og lever første milestone uten å konfigurere noe.' },
          { title: 'Vekstfase', body: 'Skaleringsklart team-rom med flere prosjekter, automatiserte leveranser og kundeoppfølging.' },
          { title: 'Profesjonell drift', body: 'Full kontroll over økonomi, klientpipeline og leveransekvalitet — ett verktøy for hele virksomheten.' },
        ],
      }),
      asFaq({
        heading: 'Vanlige spørsmål',
        items: [
          { q: 'Hvor lagres dataene?', a: 'I EU/EØS (GDPR-compliant). Databehandler-avtale (DPA) er tilgjengelig på forespørsel.' },
          { q: 'Hvor lenge varer en gratis prøveperiode?', a: 'Basis-tilgang er gratis uten utløp. Betalte produksjons-features krever abonnement.' },
          { q: 'Kan jeg eksportere dataene mine?', a: 'Ja — alle prosjekt-data kan eksporteres som JSON eller CSV når som helst.' },
        ],
      }),
      asCta({
        heading: 'Klar til å prøve?',
        body: 'Opprett en gratis konto på under ett minutt. Ingen kredittkort, ingen forpliktelser.',
        buttonLabel: 'Kom i gang gratis',
        buttonUrl: '/',
        secondaryLabel: 'Snakk med oss',
        secondaryUrl: 'mailto:hello@creatorhubn.com',
      }),
    ],
  },
  {
    key: 'comparison-page',
    label: 'Sammenligning (vs konkurrent)',
    description: 'Hero · funksjons-tabell · FAQ · CTA. Mal for vs-X-sider og alternativer-sider.',
    build: () => [
      asHero({
        audienceChip: 'Sammenligning',
        h1: 'The Role Room vs [Konkurrent]',
        subtitle: 'Nordisk alternativ med norsk språk, GDPR-trygg data og integrert AI.',
        intro: 'Se hvilken plattform som matcher din workflow best. Vi fokuserer på det vi gjør bedre — sjekk konkurrentens egne sider for deres feature-status.',
        primaryCtaLabel: 'Prøv The Role Room',
        primaryCtaUrl: '/',
        secondaryCtaLabel: 'Se andre alternativer',
        secondaryCtaUrl: '/alternatives',
      }),
      asComparison({
        heading: 'Funksjons-sammenligning',
        competitorLabel: '[Konkurrent]',
        rows: [
          { feature: 'Norsk språk i hele appen', roleRoom: 'yes', competitor: 'no' },
          { feature: 'GDPR-trygg datalagring (EU/EØS)', roleRoom: 'yes', competitor: 'unknown' },
          { feature: 'Integrert AI-agent', roleRoom: 'yes', competitor: 'no' },
          { feature: 'Talentportal (selv-registrering)', roleRoom: 'yes', competitor: 'partial' },
          { feature: 'Casting-pipeline', roleRoom: 'yes', competitor: 'yes' },
          { feature: 'Shotlist og storyboard', roleRoom: 'yes', competitor: 'yes' },
          { feature: 'Call-sheet generering', roleRoom: 'yes', competitor: 'yes' },
        ],
      }),
      asFaq({
        heading: 'Vanlige spørsmål',
        items: [
          { q: 'Hva er hovedforskjellen?', a: 'Norsk språk, GDPR i EU/EØS, og integrert AI-agent — bygget for nordisk produksjon.' },
          { q: 'Kan jeg migrere fra [Konkurrent]?', a: 'Ja, vi støtter CSV-import av roller, kandidater og crew. Kontakt support for migrasjonshjelp.' },
          { q: 'Hva er prisforskjellen?', a: 'Basis-tilgang er gratis. Betalte produksjons-features ligger på markedspris. Sjekk respektiv leverandørs side for oppdatert info.' },
        ],
      }),
      asCta({
        heading: 'Klar til å bytte?',
        body: 'Få full tilgang gratis. Vi hjelper deg å migrere data.',
        buttonLabel: 'Prøv gratis',
        buttonUrl: '/',
        secondaryLabel: 'Bestill demo',
        secondaryUrl: 'mailto:hello@theroleroom.com',
      }),
    ],
  },
  {
    key: 'press-kit',
    label: 'Press kit / Pressepakke',
    description: 'Hero · boilerplate · fakta · pressekontakt-CTA. Mal for /presse og om-oss-sider.',
    build: () => [
      asHero({
        audienceChip: 'Pressepakke',
        h1: 'Pressepakke — The Role Room',
        subtitle: 'Logo, boilerplate, fakta og pressekontakt. Bruk fritt i redaksjonell sammenheng.',
        primaryCtaLabel: 'Last ned mediepakke (zip)',
        primaryCtaUrl: '#downloads',
        secondaryCtaLabel: 'Pressekontakt',
        secondaryCtaUrl: 'mailto:presse@theroleroom.com',
      }),
      asRichText({
        heading: 'Kort boilerplate (≤ 60 ord)',
        text: '<p>The Role Room er en norsk casting- og produksjonsplattform for film, TV og innholdsproduksjon. Roller, auditions, talenter, crew, lokasjoner og storyboard samles i ett arbeidsrom — med norsk språk, GDPR-trygg datalagring og en integrert AI-agent for casting-arbeidsflyt.</p>',
      }),
      asRichText({
        heading: 'Lang boilerplate',
        text: '<p>The Role Room er en del av CreatorHub-økosystemet og bygget av nordiske produksjonsfolk for det nordiske markedet. Plattformen dekker hele casting-pipelinen — fra rolle-opprettelse og selvbetjent audition-innspilling via talentportal til opptaks-koordinering med crew, lokasjoner, kalender og kommunikasjon.</p><p>The Role Room kombinerer dette med Live Set Mode for selve opptaksdagen og DIT-backup-infrastruktur for kamera-data — alt i én samlet flate. Dataene lagres i EU/EØS med tydelig databehandler-avtale.</p>',
      }),
      asFeatureList({
        heading: 'Hurtigfakta',
        items: [
          'Lansert 2026',
          'Eier: CreatorHub AS (Norge)',
          'Marked: Norden',
          'GDPR-compliant',
          'Norsk + engelsk UI',
        ],
        style: 'chips',
      }),
      asCta({
        heading: 'Pressekontakt',
        body: 'Henvendelser fra presse, partnere og bransje besvares innen 1 virkedag.',
        buttonLabel: 'presse@theroleroom.com',
        buttonUrl: 'mailto:presse@theroleroom.com',
      }),
    ],
  },
  {
    key: 'education-landing',
    label: 'Utdanning / studie-landing',
    description: 'Hero · funksjons-liste · use-cases · relaterte studier · CTA. Mal for /for-studenter-typer.',
    build: () => [
      asHero({
        audienceChip: 'For studenter',
        h1: 'The Role Room for studenter',
        subtitle: 'Bygg et profesjonelt portefølje-rom for film-, TV- og innholdsproduksjon. Norsk språk, gratis basis-tilgang.',
        intro: 'Lær å bruke verktøyet bransjen bruker. Sett opp prosjekter, samle audition-arbeid, bygg portfolio, og knytt deg til faglige miljøer mens du studerer.',
        primaryCtaLabel: 'Kom i gang gratis',
        primaryCtaUrl: '/',
        secondaryCtaLabel: 'For utdanningsinstitusjoner',
        secondaryCtaUrl: '/utdanningsinstitusjon',
      }),
      asFeatureList({
        heading: 'Slik kan du bruke det',
        items: [
          'Opprett prosjektrom for studie-arbeid',
          'Selvbetjent audition-innspilling',
          'Storyboard og shotlist',
          'Crew-koordinering',
          'Portfolio-eksport',
          'Norsk språk-støtte',
        ],
        style: 'chips',
      }),
      asUsage({
        heading: 'Bruks-eksempler',
        items: [
          { title: 'Kortfilm-prosjekt', body: 'Casting, lokasjoner, audition-pipeline og produksjons-plan i ett rom — fra første idé til ferdig film.' },
          { title: 'Portfolio-bygger', body: 'Eksport-klare prosjekt-sammendrag som du kan dele med bransje, prospektive arbeidsgivere eller på opptak.' },
          { title: 'Klasse-samarbeid', body: 'Inviter medstudenter med tilgangsstyring per rolle (regissør, foto, lyd). Lærer kan ha overordnet tilgang.' },
        ],
      }),
      asRelated({
        heading: 'Aktuelle studier',
        items: [
          { name: 'Bachelor i film og fjernsyn', institution: 'NTNU', note: 'Indikativ — sjekk skolens nettsted for oppdatert info' },
          { name: 'Bachelor i regi', institution: 'KHiO', note: 'Indikativ — sjekk skolens nettsted for oppdatert info' },
        ],
      }),
      asCta({
        heading: 'Klar til å starte?',
        body: 'Gratis basis-tilgang for studenter. Ingen kredittkort kreves.',
        buttonLabel: 'Opprett konto',
        buttonUrl: '/',
      }),
    ],
  },
  {
    key: 'simple-content',
    label: 'Enkel innholdsside',
    description: 'Hero · rik tekst · CTA. Mal for om-oss, vilkår, kontakt og lignende sider.',
    build: () => [
      asHero({
        h1: 'Side-tittel',
        subtitle: 'Kort introduksjon til hva denne siden handler om.',
      }),
      asRichText({
        text: '<p>Skriv brødtekst her. Bruk knappene over editoren for å legge til <strong>fet</strong>, <em>kursiv</em>, lenker, lister og overskrifter.</p><h2>Underseksjon</h2><p>Du kan dele opp innholdet med h2/h3-overskrifter.</p>',
      }),
      asCta({
        heading: 'Trenger du hjelp?',
        body: 'Kontakt oss så hjelper vi deg videre.',
        buttonLabel: 'Send e-post',
        buttonUrl: 'mailto:hello@creatorhubn.com',
      }),
    ],
  },
];

export function getTemplate(key: TemplateKind): PageTemplate | undefined {
  return PAGE_TEMPLATES.find((t) => t.key === key);
}
